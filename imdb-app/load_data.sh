#!/bin/bash

# IMDb Data Loader - Enhanced Bash Version
# Loads real IMDb data into MySQL database with proper escaping
# NOTE: For best performance and features, use load_data.py instead

DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_USER="imdb_user"
DB_PASSWORD="imdb_pass"
DB_NAME="imdb_app"

DATA_DIR="/Users/doankhoa/Documents/Fall 25/Database systems/Data"

# Configuration - Increased limits
PEOPLE_LIMIT=50000
TITLES_LIMIT=20000
CAST_LIMIT=200000

echo "📚 IMDb Data Loader (Enhanced Bash Version)"
echo "==========================================="
echo "Configuration:"
echo "  • People limit: $PEOPLE_LIMIT"
echo "  • Titles limit: $TITLES_LIMIT"
echo "  • Cast/Crew limit: $CAST_LIMIT"
echo "==========================================="

# Function to properly escape SQL strings
escape_sql() {
    echo "$1" | sed "s/'/''/g"
}

# Function to execute MySQL queries
mysql_exec() {
    docker exec -i imdb-mysql mysql -h localhost -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null
}

# Step 1: Load genres
echo ""
echo "📚 Loading genres..."
{
    cat << 'EOF'
INSERT IGNORE INTO genre_lookup (genre_name) VALUES 
('Action'), ('Adventure'), ('Animation'), ('Biography'), ('Comedy'), ('Crime'),
('Documentary'), ('Drama'), ('Family'), ('Fantasy'), ('Film-Noir'), ('Game-Show'),
('History'), ('Horror'), ('Music'), ('Musical'), ('Mystery'), ('News'), ('Reality-TV'),
('Romance'), ('Sci-Fi'), ('Short'), ('Sport'), ('Talk-Show'), ('Thriller'),
('War'), ('Western');
EOF
} | mysql_exec
echo "✓ Genres loaded"

# Step 2: Load people using a temporary file to handle special characters
echo ""
echo "👥 Loading people (first $PEOPLE_LIMIT)..."

# Create a temp SQL file
TEMP_PEOPLE="/tmp/people_load.sql"
> "$TEMP_PEOPLE"

awk -F'\t' -v limit="$PEOPLE_LIMIT" 'NR>1 && NR<=limit+1 {
    nconst=$1
    name=$2
    birth=$3
    death=$4
    
    # Handle \N values - keep as NULL
    if (birth == "\\N") birth = "NULL"
    else birth = "\"" birth "\""
    
    if (death == "\\N") death = "NULL"
    else death = "\"" death "\""
    
    # Escape single quotes by doubling them
    gsub(/'"'"'/, "'"'"''"'"'", name)
    
    printf "INSERT IGNORE INTO person (imdb_nconst, primary_name, birth_year, death_year) VALUES ('\''%s'\'', '\''%s'\'', %s, %s);\n", nconst, name, birth, death
}' "$DATA_DIR/name.basics.tsv" >> "$TEMP_PEOPLE"

cat "$TEMP_PEOPLE" | mysql_exec > /dev/null 2>&1
rm -f "$TEMP_PEOPLE"
echo "✓ People loaded"

# Step 3: Load titles using a temporary file
echo ""
echo "🎬 Loading titles (first $TITLES_LIMIT)..."

TEMP_TITLES="/tmp/titles_load.sql"
> "$TEMP_TITLES"

awk -F'\t' -v limit="$TITLES_LIMIT" 'NR>1 && NR<=limit+1 {
    tconst=$1
    type=$2
    title=$3
    adult=$5
    year=$6
    runtime=$8
    
    # Skip unwanted types
    if (type !~ /^(movie|tvSeries|tvMovie|tvEpisode|tvMiniSeries)$/) next
    
    # Handle \N values
    if (year == "\\N") year = "NULL"
    else year = "\"" year "\""
    
    if (runtime == "\\N") runtime = "NULL"
    else runtime = "\"" runtime "\""
    
    # Escape single quotes
    gsub(/'"'"'/, "'"'"''"'"'", title)
    
    printf "INSERT IGNORE INTO title (imdb_tconst, primary_title, start_year, title_type, runtime_minutes, is_adult) VALUES ('\''%s'\'', '\''%s'\'', %s, '\''%s'\'', %s, %d);\n", tconst, title, year, type, runtime, adult
}' "$DATA_DIR/title.basics.tsv" >> "$TEMP_TITLES"

cat "$TEMP_TITLES" | mysql_exec > /dev/null 2>&1
rm -f "$TEMP_TITLES"
echo "✓ Titles loaded"

# Step 4: Load ratings
echo ""
echo "⭐ Loading ratings..."

TEMP_RATINGS="/tmp/ratings_load.sql"
> "$TEMP_RATINGS"

awk -F'\t' 'NR>1 {
    tconst=$1
    rating=$2
    votes=$3
    
    printf "UPDATE title SET avg_rating=%s, num_votes=%d WHERE imdb_tconst='\''%s'\'';\n", rating, votes, tconst
}' "$DATA_DIR/title.ratings.tsv" >> "$TEMP_RATINGS"

cat "$TEMP_RATINGS" | mysql_exec > /dev/null 2>&1
rm -f "$TEMP_RATINGS"
echo "✓ Ratings loaded"

# Step 5: Load genres for titles
echo ""
echo "🏷️  Loading title-genre relationships..."

TEMP_TG="/tmp/title_genres_load.sql"
> "$TEMP_TG"

awk -F'\t' -v limit="$TITLES_LIMIT" 'NR>1 && NR<=limit+1 {
    tconst=$1
    genres=$9
    
    # Parse comma-separated genres
    n = split(genres, g, ",")
    for (i=1; i<=n; i++) {
        genre = g[i]
        gsub(/ /, "", genre)  # Remove spaces
        if (genre != "" && genre != "\\N") {
            printf "INSERT IGNORE INTO title_genre (title_id, genre_id) SELECT t.title_id, g.genre_id FROM title t, genre_lookup g WHERE t.imdb_tconst='\''%s'\'' AND g.genre_name='\''%s'\'';\n", tconst, genre
        }
    }
}' "$DATA_DIR/title.basics.tsv" >> "$TEMP_TG"

cat "$TEMP_TG" | mysql_exec > /dev/null 2>&1
rm -f "$TEMP_TG"
echo "✓ Title-genre relationships loaded"

# Step 6: Load cast and crew with character data
echo ""
echo "🎭 Loading cast & crew with characters (first $CAST_LIMIT)..."

TEMP_CREW="/tmp/crew_load.sql"
> "$TEMP_CREW"

awk -F'\t' -v limit="$CAST_LIMIT" 'NR>1 && NR<=limit+1 {
    tconst=$1
    nconst=$3
    category=$4
    characters=$6
    
    # Only load relevant roles
    if (category !~ /^(actor|actress|director|writer|producer|composer|cinematographer|editor)$/) next
    
    # Normalize role
    role = (category ~ /^(actor|actress)$/) ? "actor" : category
    
    # Handle characters field - clean up brackets and quotes
    if (characters != "" && characters != "\\N") {
        gsub(/^\[|\]$/, "", characters)  # Remove brackets
        gsub(/"/, "", characters)        # Remove quotes
        gsub(/'"'"'/, "'"'"''"'"'", characters)  # Escape single quotes
        chars = "'\''" characters "'\''"
    } else {
        chars = "NULL"
    }
    
    printf "INSERT IGNORE INTO title_person_role (title_id, person_id, role_type, characters) SELECT t.title_id, p.person_id, '\''%s'\'', %s FROM title t, person p WHERE t.imdb_tconst='\''%s'\'' AND p.imdb_nconst='\''%s'\'';\n", role, chars, tconst, nconst
}' "$DATA_DIR/title.principals.tsv" >> "$TEMP_CREW"

cat "$TEMP_CREW" | mysql_exec > /dev/null 2>&1
rm -f "$TEMP_CREW"
echo "✓ Cast & crew loaded"

# Step 8: Create comprehensive sample user ratings
echo ""
echo "⭐ Creating comprehensive user ratings..."
{
    cat << 'EOF'
-- High-rated popular titles
INSERT IGNORE INTO user_rating (user_id, title_id, rating_value, review_text)
SELECT 
    1 + MOD(t.title_id, 4),
    t.title_id,
    CASE 
        WHEN MOD(t.title_id, 5) = 0 THEN 10
        WHEN MOD(t.title_id, 5) = 1 THEN 9
        WHEN MOD(t.title_id, 5) = 2 THEN 8
        WHEN MOD(t.title_id, 5) = 3 THEN 7
        ELSE 6
    END as rating_value,
    CASE MOD(t.title_id, 6)
        WHEN 0 THEN 'Excellent film! Highly recommended.'
        WHEN 1 THEN 'A masterpiece of cinema.'
        WHEN 2 THEN 'Really enjoyed this one.'
        WHEN 3 THEN 'Worth watching, great story.'
        WHEN 4 THEN 'One of my favorites!'
        ELSE NULL
    END as review_text
FROM title t
WHERE t.avg_rating >= 7.0 AND t.num_votes >= 1000 AND t.title_type IN ('movie', 'tvSeries')
LIMIT 500;
EOF
} | mysql_exec > /dev/null 2>&1
echo "✓ Comprehensive user ratings created"

# Step 9: Verify data
echo ""
echo "=========================================="
echo "✓ Data Verification:"
echo "=========================================="
{
    cat << 'EOF'
SELECT 'Users' as 'Table', COUNT(*) as 'Count' FROM app_user 
UNION ALL SELECT 'Titles', COUNT(*) FROM title 
UNION ALL SELECT 'People', COUNT(*) FROM person 
UNION ALL SELECT 'Genres', COUNT(*) FROM genre_lookup 
UNION ALL SELECT 'Title-Genre', COUNT(*) FROM title_genre 
UNION ALL SELECT 'Cast/Crew', COUNT(*) FROM title_person_role 
UNION ALL SELECT 'User Ratings', COUNT(*) FROM user_rating;
EOF
} | mysql_exec

echo ""
echo "📊 Additional Statistics:"
echo ""

echo "Titles by Type:"
{
    cat << 'EOF'
SELECT title_type, COUNT(*) as cnt 
FROM title 
GROUP BY title_type 
ORDER BY cnt DESC;
EOF
} | mysql_exec

echo ""
echo "Cast/Crew by Role:"
{
    cat << 'EOF'
SELECT role_type, COUNT(*) as cnt 
FROM title_person_role 
GROUP BY role_type 
ORDER BY cnt DESC;
EOF
} | mysql_exec

echo ""
echo "✅ Data loading completed!"
echo ""
echo "💡 Tip: For better performance and more features, use load_data.py instead"
