#!/usr/bin/env python3
"""
IMDb Data Loader - Enhanced Version
Loads comprehensive IMDb data into MySQL database with:
- More data (50k+ people, 20k+ titles, 200k+ cast/crew)
- Character data from title.principals.tsv
- Crew data from title.crew.tsv
- Batch processing for better performance
- Comprehensive user ratings
"""

import mysql.connector
import os
import sys
from pathlib import Path
from collections import defaultdict
import time

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'imdb_user',
    'password': 'imdb_pass',
    'database': 'imdb_app',
    'port': 3306,
    'autocommit': False
}

DATA_DIR = Path('/Users/doankhoa/Documents/Fall 25/Database systems/Data')

class IMDbDataLoader:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.title_map = {}  # tconst -> title_id
        self.person_map = {}  # nconst -> person_id
        self.genre_map = {}   # genre_name -> genre_id
        self.batch_size = 1000  # Batch insert size
        
    def connect(self):
        try:
            self.conn = mysql.connector.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor()
            print("✓ Connected to MySQL")
        except mysql.connector.Error as err:
            print(f"✗ Connection failed: {err}")
            sys.exit(1)
    
    def disconnect(self):
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("✓ Disconnected from MySQL")
    
    def execute(self, query, params=None, commit=True):
        try:
            if params:
                self.cursor.execute(query, params)
            else:
                self.cursor.execute(query)
            if commit:
                self.conn.commit()
            return self.cursor.fetchall() if query.strip().upper().startswith('SELECT') else None
        except mysql.connector.Error as err:
            self.conn.rollback()
            print(f"✗ Query error: {err}")
            return None
    
    def execute_batch(self, query, params_list):
        """Execute batch insert for better performance"""
        try:
            self.cursor.executemany(query, params_list)
            self.conn.commit()
            return len(params_list)
        except mysql.connector.Error as err:
            self.conn.rollback()
            print(f"✗ Batch error: {err}")
            return 0
    
    def load_genres(self):
        print("\n📚 Loading genres...")
        genres = {
            'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
            'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'Game-Show',
            'History', 'Horror', 'Music', 'Musical', 'Mystery', 'News', 'Reality-TV',
            'Romance', 'Sci-Fi', 'Short', 'Sport', 'Talk-Show', 'Thriller',
            'War', 'Western'
        }
        
        for genre in sorted(genres):
            query = "INSERT IGNORE INTO genre_lookup (genre_name) VALUES (%s)"
            self.execute(query, (genre,))

        result = self.execute("SELECT genre_id, genre_name FROM genre_lookup", commit=False)
        for genre_id, genre_name in result:
            self.genre_map[genre_name] = genre_id
        
        print(f"✓ Loaded {len(self.genre_map)} genres")
    
    def load_people(self, limit=50000):
        """Load people with increased limit"""
        print(f"\n👥 Loading people (limit: {limit:,})...")
        
        file_path = DATA_DIR / 'name.basics.tsv'
        if not file_path.exists():
            print(f"✗ File not found: {file_path}")
            return
        
        count = 0
        batch = []
        start_time = time.time()
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.readline()  # Skip header
            for line in f:
                if count >= limit:
                    break
                
                parts = line.strip().split('\t')
                if len(parts) < 5:
                    continue
                
                nconst, primary_name, birth_year, death_year = parts[0], parts[1], parts[2], parts[3]
                
                # Convert \N to NULL
                birth_year = None if birth_year == '\\N' else int(birth_year)
                death_year = None if death_year == '\\N' else int(death_year)
                
                batch.append((nconst, primary_name, birth_year, death_year))
                count += 1
                
                if len(batch) >= self.batch_size:
                    query = """
                        INSERT IGNORE INTO person (imdb_nconst, primary_name, birth_year, death_year)
                        VALUES (%s, %s, %s, %s)
                    """
                    self.execute_batch(query, batch)
                    batch = []
                    if count % 10000 == 0:
                        elapsed = time.time() - start_time
                        rate = count / elapsed if elapsed > 0 else 0
                        print(f"  Loaded {count:,} people... ({rate:.0f} records/sec)")
        
        # Insert remaining batch
        if batch:
            query = """
                INSERT IGNORE INTO person (imdb_nconst, primary_name, birth_year, death_year)
                VALUES (%s, %s, %s, %s)
            """
            self.execute_batch(query, batch)
        
        # Build person map
        result = self.execute("SELECT person_id, imdb_nconst FROM person", commit=False)
        for person_id, nconst in result:
            self.person_map[nconst] = person_id
        
        print(f"✓ Loaded {count:,} people")
    
    def load_titles(self, limit=20000):
        """Load titles with increased limit and better filtering"""
        print(f"\n🎬 Loading titles (limit: {limit:,})...")
        
        file_path = DATA_DIR / 'title.basics.tsv'
        if not file_path.exists():
            print(f"✗ File not found: {file_path}")
            return
        
        count = 0
        batch = []
        start_time = time.time()
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.readline()  # Skip header
            for line in f:
                if count >= limit:
                    break
                
                parts = line.strip().split('\t')
                if len(parts) < 9:
                    continue
                
                tconst = parts[0]
                title_type = parts[1]
                primary_title = parts[2]
                is_adult = int(parts[4])
                start_year = None if parts[5] == '\\N' else int(parts[5])
                runtime_minutes = None if parts[7] == '\\N' else int(parts[7])
                
                # Filter: only movies, TV series, and TV movies
                if title_type not in ['movie', 'tvSeries', 'tvMovie', 'tvEpisode', 'tvMiniSeries']:
                    continue
                
                batch.append((tconst, primary_title, start_year, title_type, runtime_minutes, is_adult))
                count += 1
                
                if len(batch) >= self.batch_size:
                    query = """
                        INSERT IGNORE INTO title (imdb_tconst, primary_title, start_year, title_type, 
                                                  runtime_minutes, is_adult)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """
                    self.execute_batch(query, batch)
                    batch = []
                    if count % 5000 == 0:
                        elapsed = time.time() - start_time
                        rate = count / elapsed if elapsed > 0 else 0
                        print(f"  Loaded {count:,} titles... ({rate:.0f} records/sec)")
        
        # Insert remaining batch
        if batch:
            query = """
                INSERT IGNORE INTO title (imdb_tconst, primary_title, start_year, title_type, 
                                          runtime_minutes, is_adult)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            self.execute_batch(query, batch)
        
        # Build title map
        result = self.execute("SELECT title_id, imdb_tconst FROM title", commit=False)
        self.title_map = {tconst: title_id for title_id, tconst in result}
        
        print(f"✓ Loaded {count:,} titles")
    
    def load_ratings(self):
        """Load IMDb ratings for all loaded titles"""
        print("\n⭐ Loading IMDb ratings...")
        
        file_path = DATA_DIR / 'title.ratings.tsv'
        if not file_path.exists():
            print(f"✗ File not found: {file_path}")
            return
        
        count = 0
        updated = 0
        batch = []
        start_time = time.time()
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.readline()  # Skip header
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) < 3:
                    continue
                
                tconst = parts[0]
                avg_rating = float(parts[1])
                num_votes = int(parts[2])
                
                if tconst in self.title_map:
                    batch.append((avg_rating, num_votes, tconst))
                    count += 1
                    
                    if len(batch) >= self.batch_size:
                        query = "UPDATE title SET avg_rating = %s, num_votes = %s WHERE imdb_tconst = %s"
                        updated += self.execute_batch(query, batch)
                        batch = []
                        if count % 10000 == 0:
                            elapsed = time.time() - start_time
                            rate = count / elapsed if elapsed > 0 else 0
                            print(f"  Updated {count:,} ratings... ({rate:.0f} records/sec)")
        
        # Update remaining batch
        if batch:
            query = "UPDATE title SET avg_rating = %s, num_votes = %s WHERE imdb_tconst = %s"
            updated += self.execute_batch(query, batch)
        
        print(f"✓ Updated {updated:,} title ratings")
    
    def load_genres_for_titles(self):
        """Parse and load genres for titles"""
        print("\n🏷️  Loading title-genre relationships...")
        
        file_path = DATA_DIR / 'title.basics.tsv'
        if not file_path.exists():
            print(f"✗ File not found: {file_path}")
            return
        
        count = 0
        batch = []
        start_time = time.time()
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.readline()  # Skip header
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) < 9:
                    continue
                
                tconst = parts[0]
                genres_str = parts[8]
                
                if tconst not in self.title_map:
                    continue
                
                title_id = self.title_map[tconst]
                
                # Parse genres (comma-separated)
                if genres_str and genres_str != '\\N':
                    genres = [g.strip() for g in genres_str.split(',')]
                    for genre in genres:
                        if genre and genre in self.genre_map:
                            genre_id = self.genre_map[genre]
                            batch.append((title_id, genre_id))
                            count += 1
                            
                            if len(batch) >= self.batch_size:
                                query = "INSERT IGNORE INTO title_genre (title_id, genre_id) VALUES (%s, %s)"
                                self.execute_batch(query, batch)
                                batch = []
                                if count % 10000 == 0:
                                    elapsed = time.time() - start_time
                                    rate = count / elapsed if elapsed > 0 else 0
                                    print(f"  Linked {count:,} genres... ({rate:.0f} records/sec)")
        
        # Insert remaining batch
        if batch:
            query = "INSERT IGNORE INTO title_genre (title_id, genre_id) VALUES (%s, %s)"
            self.execute_batch(query, batch)
        
        print(f"✓ Linked {count:,} title-genre relationships")
    
    def load_cast_and_crew_from_principals(self, limit=200000):
        """Load cast and crew from title.principals.tsv with character data"""
        print(f"\n🎭 Loading cast & crew from principals (limit: {limit:,})...")
        
        file_path = DATA_DIR / 'title.principals.tsv'
        if not file_path.exists():
            print(f"✗ File not found: {file_path}")
            return
        
        count = 0
        batch = []
        start_time = time.time()
        
        # Role mapping
        role_mapping = {
            'actor': 'actor',
            'actress': 'actor',
            'director': 'director',
            'writer': 'writer',
            'producer': 'producer',
            'composer': 'composer',
            'cinematographer': 'cinematographer',
            'editor': 'editor'
        }
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.readline()  # Skip header
            for line in f:
                if count >= limit:
                    break
                
                parts = line.strip().split('\t')
                if len(parts) < 4:
                    continue
                
                tconst = parts[0]
                nconst = parts[2]
                category = parts[3]
                characters = parts[5] if len(parts) > 5 and parts[5] != '\\N' else None
                
                if tconst not in self.title_map or nconst not in self.person_map:
                    continue
                
                # Map category to role_type
                role_type = role_mapping.get(category)
                if not role_type:
                    continue
                
                title_id = self.title_map[tconst]
                person_id = self.person_map[nconst]
                
                # Clean up characters field (remove brackets and quotes)
                if characters:
                    characters = characters.strip('[]"')
                
                batch.append((title_id, person_id, role_type, characters))
                count += 1
                
                if len(batch) >= self.batch_size:
                    query = """
                        INSERT IGNORE INTO title_person_role (title_id, person_id, role_type, characters)
                        VALUES (%s, %s, %s, %s)
                    """
                    self.execute_batch(query, batch)
                    batch = []
                    if count % 20000 == 0:
                        elapsed = time.time() - start_time
                        rate = count / elapsed if elapsed > 0 else 0
                        print(f"  Loaded {count:,} cast/crew entries... ({rate:.0f} records/sec)")
        
        # Insert remaining batch
        if batch:
            query = """
                INSERT IGNORE INTO title_person_role (title_id, person_id, role_type, characters)
                VALUES (%s, %s, %s, %s)
            """
            self.execute_batch(query, batch)
        
        print(f"✓ Loaded {count:,} cast & crew entries from principals")
    
    def load_crew_from_crew_file(self, limit=50000):
        """Load additional crew data from title.crew.tsv (directors, writers)"""
        print(f"\n🎬 Loading crew from crew file (limit: {limit:,})...")
        
        file_path = DATA_DIR / 'title.crew.tsv'
        if not file_path.exists():
            print(f"⚠ File not found: {file_path} (skipping)")
            return
        
        count = 0
        batch = []
        start_time = time.time()
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            f.readline()  # Skip header
            for line in f:
                if count >= limit:
                    break
                
                parts = line.strip().split('\t')
                if len(parts) < 3:
                    continue
                
                tconst = parts[0]
                directors_str = parts[1] if parts[1] != '\\N' else None
                writers_str = parts[2] if len(parts) > 2 and parts[2] != '\\N' else None
                
                if tconst not in self.title_map:
                    continue
                
                title_id = self.title_map[tconst]
                
                # Process directors
                if directors_str:
                    directors = [d.strip() for d in directors_str.split(',')]
                    for nconst in directors:
                        if nconst in self.person_map:
                            person_id = self.person_map[nconst]
                            batch.append((title_id, person_id, 'director', None))
                            count += 1
                
                # Process writers
                if writers_str:
                    writers = [w.strip() for w in writers_str.split(',')]
                    for nconst in writers:
                        if nconst in self.person_map:
                            person_id = self.person_map[nconst]
                            batch.append((title_id, person_id, 'writer', None))
                            count += 1
                
                if len(batch) >= self.batch_size:
                    query = """
                        INSERT IGNORE INTO title_person_role (title_id, person_id, role_type, characters)
                        VALUES (%s, %s, %s, %s)
                    """
                    self.execute_batch(query, batch)
                    batch = []
                    if count % 10000 == 0:
                        elapsed = time.time() - start_time
                        rate = count / elapsed if elapsed > 0 else 0
                        print(f"  Loaded {count:,} crew entries... ({rate:.0f} records/sec)")
        
        # Insert remaining batch
        if batch:
            query = """
                INSERT IGNORE INTO title_person_role (title_id, person_id, role_type, characters)
                VALUES (%s, %s, %s, %s)
            """
            self.execute_batch(query, batch)
        
        print(f"✓ Loaded {count:,} crew entries from crew file")
    
    def create_comprehensive_user_ratings(self):
        """Create comprehensive sample user ratings"""
        print("\n⭐ Creating comprehensive user ratings...")
        
        # Get titles with ratings, prioritizing popular and well-rated titles
        queries = [
            # High-rated popular titles
            """
            SELECT title_id FROM title 
            WHERE avg_rating >= 8.0 AND num_votes >= 10000
            ORDER BY avg_rating DESC, num_votes DESC
            LIMIT 200
            """,
            # Medium-rated popular titles
            """
            SELECT title_id FROM title 
            WHERE avg_rating >= 7.0 AND num_votes >= 5000
            ORDER BY avg_rating DESC, num_votes DESC
            LIMIT 300
            """,
            # Recent titles with good ratings
            """
            SELECT title_id FROM title 
            WHERE avg_rating >= 6.5 AND num_votes >= 1000 AND start_year >= 2010
            ORDER BY start_year DESC, avg_rating DESC
            LIMIT 200
            """
        ]
        
        all_title_ids = []
        for query in queries:
            results = self.execute(query, commit=False)
            if results:
                all_title_ids.extend([row[0] for row in results])
        
        if not all_title_ids:
            print("✗ No titles found for ratings")
            return
        
        # Remove duplicates
        all_title_ids = list(set(all_title_ids))
        
        user_ids = [1, 2, 3, 4]
        reviews = [
            'Excellent film! Highly recommended.',
            'A masterpiece of cinema.',
            'Really enjoyed this one.',
            'Worth watching, great story.',
            'One of my favorites!',
            'Solid entertainment.',
            'Good but not great.',
            'Decent watch.',
            'Could be better.',
            None  # Some ratings without reviews
        ]
        
        count = 0
        batch = []
        
        for idx, title_id in enumerate(all_title_ids):
            for user_id in user_ids:
                # Vary ratings based on title quality (simulate realistic ratings)
                base_rating = 7 if idx < 200 else (6 if idx < 500 else 5)
                rating_variation = (idx + user_id) % 4  # Add some variation
                rating_value = min(10, max(1, base_rating + rating_variation - 1))
                
                review_text = reviews[(idx + user_id) % len(reviews)]
                
                batch.append((user_id, title_id, rating_value, review_text))
                count += 1
                
                if len(batch) >= self.batch_size:
                    query = """
                        INSERT IGNORE INTO user_rating (user_id, title_id, rating_value, review_text)
                        VALUES (%s, %s, %s, %s)
                    """
                    self.execute_batch(query, batch)
                    batch = []
                    if count % 500 == 0:
                        print(f"  Created {count:,} user ratings...")
        
        # Insert remaining batch
        if batch:
            query = """
                INSERT IGNORE INTO user_rating (user_id, title_id, rating_value, review_text)
                VALUES (%s, %s, %s, %s)
            """
            self.execute_batch(query, batch)
        
        print(f"✓ Created {count:,} comprehensive user ratings")
    
    def verify_data(self):
        """Verify loaded data with detailed statistics"""
        print("\n" + "="*60)
        print("📊 Data Verification Report")
        print("="*60)
        
        stats = [
            ("Users", "SELECT COUNT(*) FROM app_user"),
            ("Titles", "SELECT COUNT(*) FROM title"),
            ("People", "SELECT COUNT(*) FROM person"),
            ("Genres", "SELECT COUNT(*) FROM genre_lookup"),
            ("Title-Genre links", "SELECT COUNT(*) FROM title_genre"),
            ("Cast/Crew entries", "SELECT COUNT(*) FROM title_person_role"),
            ("User Ratings", "SELECT COUNT(*) FROM user_rating"),
        ]
        
        for name, query in stats:
            result = self.execute(query, commit=False)
            count = result[0][0] if result else 0
            print(f"  • {name:.<30} {count:>10,}")
        
        # Additional statistics
        print("\n📈 Additional Statistics:")
        
        # Titles by type
        result = self.execute("""
            SELECT title_type, COUNT(*) as cnt 
            FROM title 
            GROUP BY title_type 
            ORDER BY cnt DESC
        """, commit=False)
        if result:
            print("\n  Titles by Type:")
            for title_type, cnt in result:
                print(f"    • {title_type:.<25} {cnt:>10,}")
        
        # Cast/Crew by role
        result = self.execute("""
            SELECT role_type, COUNT(*) as cnt 
            FROM title_person_role 
            GROUP BY role_type 
            ORDER BY cnt DESC
        """, commit=False)
        if result:
            print("\n  Cast/Crew by Role:")
            for role_type, cnt in result:
                print(f"    • {role_type:.<25} {cnt:>10,}")
        
        # Ratings statistics
        result = self.execute("""
            SELECT 
                COUNT(*) as total,
                AVG(rating_value) as avg_rating,
                MIN(rating_value) as min_rating,
                MAX(rating_value) as max_rating
            FROM user_rating
        """, commit=False)
        if result and result[0][0]:
            total, avg, min_r, max_r = result[0]
            print(f"\n  User Ratings Statistics:")
            print(f"    • Total Ratings: {total:,}")
            print(f"    • Average Rating: {avg:.2f}/10")
            print(f"    • Rating Range: {min_r} - {max_r}")
        
        print("="*60)
    
    def run(self, people_limit=50000, titles_limit=20000, cast_limit=200000):
        """Run the complete data loading process with configurable limits"""
        print("="*60)
        print("🚀 IMDb Enhanced Data Loader")
        print("="*60)
        print(f"Configuration:")
        print(f"  • People limit: {people_limit:,}")
        print(f"  • Titles limit: {titles_limit:,}")
        print(f"  • Cast/Crew limit: {cast_limit:,}")
        print(f"  • Batch size: {self.batch_size:,}")
        print("="*60)
        
        start_time = time.time()
        self.connect()
        
        try:
            self.load_genres()
            self.load_people(limit=people_limit)
            self.load_titles(limit=titles_limit)
            self.load_ratings()
            self.load_genres_for_titles()
            self.load_cast_and_crew_from_principals(limit=cast_limit)
            self.load_crew_from_crew_file(limit=50000)
            self.create_comprehensive_user_ratings()
            self.verify_data()
            
            elapsed = time.time() - start_time
            print(f"\n✅ Data loading completed successfully!")
            print(f"⏱️  Total time: {elapsed:.2f} seconds ({elapsed/60:.2f} minutes)")
        except Exception as e:
            print(f"\n✗ Error during data loading: {e}")
            import traceback
            traceback.print_exc()
            self.conn.rollback()
        finally:
            self.disconnect()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Load IMDb data into MySQL database')
    parser.add_argument('--people', type=int, default=50000, help='Limit for people (default: 50000)')
    parser.add_argument('--titles', type=int, default=20000, help='Limit for titles (default: 20000)')
    parser.add_argument('--cast', type=int, default=200000, help='Limit for cast/crew (default: 200000)')
    
    args = parser.parse_args()
    
    loader = IMDbDataLoader()
    loader.run(
        people_limit=args.people,
        titles_limit=args.titles,
        cast_limit=args.cast
    )
