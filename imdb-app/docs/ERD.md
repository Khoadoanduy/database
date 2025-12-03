# IMDb Recommendations App - Entity-Relationship Diagram (ERD)

## Database Schema Overview

**Database**: `imdb_app`  
**Character Set**: utf8mb4  
**Collation**: utf8mb4_unicode_ci  
**Engine**: InnoDB

---

## Entity-Relationship Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        IMDb Recommendations Database                     │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   app_user       │
                              ├──────────────────┤
                              │ PK: user_id      │
                              │    username (U)  │
                              │    email (U)     │
                              │    is_admin      │
                              │    created_at    │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    │ (1:N)            │ (1:N)            │ (1:N)
                    │                  │                  │
         ┌──────────▼────────────┐     │    ┌─────────────▼──────┐
         │   user_rating        │     │    │  title_person_role │
         ├──────────────────────┤     │    ├────────────────────┤
         │ PK: rating_id        │     │    │ PK: (title_id,     │
         │ FK: user_id ────────┘     │    │     person_id,     │
         │ FK: title_id ─────────────┼────┤     role_type)     │
         │ rating_value (C:1-10)     │    │ FK: title_id ──────┐
         │ review_text (C: <=500)    │    │ FK: person_id ───┐ │
         │ rated_at (PK, auto)       │    │ role_type (C)    │ │
         │ UNIQUE: (user_id,title_id)│    └────────────────────┘
         └──────────────────────────┘             │
                    │                              │
                    │ (N:1)                        │ (N:1)
                    │                              │
                    └──────────────────┬───────────┘
                                       │
                          ┌────────────▼──────────────┐
                          │       title              │
                          ├──────────────────────────┤
                          │ PK: title_id             │
                          │ imdb_tconst (U)          │
                          │ primary_title            │
                          │ start_year (C: >=1870)   │
                          │ title_type               │
                          │ runtime_minutes (C: >0)  │
                          │ is_adult                 │
                          │ avg_rating               │
                          │ num_votes                │
                          └────────┬─────────────────┘
                                   │
                         ┌─────────┴──────────┐
                         │                    │
                    (N:M) │                    │ (N:M)
                         │                    │
         ┌───────────────▼───────┐  ┌────────▼────────────┐
         │  title_genre          │  │  person             │
         ├───────────────────────┤  ├─────────────────────┤
         │ PK: (title_id,        │  │ PK: person_id       │
         │      genre_id)        │  │ imdb_nconst (U)     │
         │ FK: title_id ─────────┤  │ primary_name        │
         │ FK: genre_id ────────┐│  │ birth_year (C:>=1850)
         └───────────────────────┘│  │ death_year (C)      │
                         │         │  │ UNIQUE:             │
                    (N:1)│         │  │   (birth>=death)    │
                         │         │  └─────────────────────┘
         ┌───────────────▼─────────┐
         │   genre_lookup          │
         ├─────────────────────────┤
         │ PK: genre_id            │
         │     genre_name (U)      │
         │     (27 standard genres)│
         └─────────────────────────┘
```

---

## Table Specifications

### 1. **app_user** - Demo Users and Administrators

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | INT | PK, AUTO_INCREMENT | Unique user identifier |
| username | VARCHAR(50) | NOT NULL, UNIQUE | Username for login |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Email address |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |
| is_admin | TINYINT(1) | DEFAULT 0 | Administrator flag |

**Constraints**:
- `uq_app_user_username` - UNIQUE(username)
- `uq_app_user_email` - UNIQUE(email)
- `chk_username_not_empty` - CHECK(username <> '')

**Indexes**: PRIMARY KEY (user_id)

**Sample Data**: 4 demo users (alice, bob, carol, demo_user)

---

### 2. **title** - Movies and TV Series Metadata

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| title_id | INT | PK, AUTO_INCREMENT | Unique title identifier |
| imdb_tconst | VARCHAR(12) | UNIQUE, NULL | IMDb title ID (tt0000001) |
| primary_title | TEXT | NOT NULL | Movie/series title |
| start_year | INT | CHECK >= 1870, NULL | Release year |
| title_type | VARCHAR(20) | NOT NULL | 'movie', 'tvSeries', 'tvMovie' |
| runtime_minutes | INT | CHECK > 0, NULL | Duration in minutes |
| is_adult | TINYINT(1) | DEFAULT 0 | Adult content flag |
| avg_rating | DECIMAL(3,1) | NULL | IMDb average rating (0.0-10.0) |
| num_votes | INT | DEFAULT 0 | Number of IMDb votes |

**Constraints**:
- `uq_title_imdb_tconst` - UNIQUE(imdb_tconst)
- `chk_start_year` - CHECK(start_year IS NULL OR start_year >= 1870)
- `chk_runtime` - CHECK(runtime_minutes IS NULL OR runtime_minutes > 0)

**Indexes**:
- PRIMARY KEY (title_id)
- idx_title_title_type_start_year (COMPOSITE: title_type, start_year)
- idx_title_primary_title (primary_title(100))

**Data**: 264 titles loaded from IMDb dataset

---

### 3. **person** - Actors, Directors, Writers

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| person_id | INT | PK, AUTO_INCREMENT | Unique person identifier |
| imdb_nconst | VARCHAR(12) | UNIQUE, NULL | IMDb name ID (nm0000001) |
| primary_name | TEXT | NOT NULL | Actor/director/writer name |
| birth_year | INT | CHECK >= 1850, NULL | Birth year |
| death_year | INT | CHECK, NULL | Death year (if applicable) |

**Constraints**:
- `uq_person_imdb_nconst` - UNIQUE(imdb_nconst)
- `chk_birth_year` - CHECK(birth_year IS NULL OR birth_year >= 1850)
- `chk_death_year` - CHECK(death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year)

**Indexes**: PRIMARY KEY (person_id)

**Data**: 4,990 people from IMDb dataset

---

### 4. **genre_lookup** - Reference Table for Genres

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| genre_id | INT | PK, AUTO_INCREMENT | Unique genre identifier |
| genre_name | VARCHAR(50) | NOT NULL, UNIQUE | Genre name (e.g., 'Drama', 'Action') |

**Constraints**:
- `uq_genre_name` - UNIQUE(genre_name)

**Indexes**: PRIMARY KEY (genre_id)

**Standard Genres** (27 total):
Action, Adventure, Animation, Biography, Comedy, Crime, Documentary, Drama, Family, Fantasy, Film-Noir, Game-Show, History, Horror, Music, Musical, Mystery, News, Reality-TV, Romance, Sci-Fi, Short, Sport, Talk-Show, Thriller, War, Western

---

### 5. **title_genre** - Junction Table (Many-to-Many)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| title_id | INT | PK (part 1), FK | Reference to title |
| genre_id | INT | PK (part 2), FK | Reference to genre_lookup |

**Constraints**:
- PK: (title_id, genre_id)
- `fk_title_genre_title` - FK(title_id) → title(title_id) ON DELETE CASCADE
- `fk_title_genre_genre` - FK(genre_id) → genre_lookup(genre_id) ON DELETE RESTRICT

**Indexes**:
- PRIMARY KEY (title_id, genre_id)
- idx_title_genre_genre_id (genre_id)

**Purpose**: Maps each title to its genres (many titles per genre, many genres per title)

**Data**: 167 title-genre relationships loaded

---

### 6. **title_person_role** - Junction Table (Many-to-Many)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| title_id | INT | PK (part 1), FK | Reference to title |
| person_id | INT | PK (part 2), FK | Reference to person |
| role_type | VARCHAR(30) | PK (part 3) | 'actor', 'director', 'writer', 'producer' |
| characters | TEXT | NULL | Character names (for actors) |

**Constraints**:
- PK: (title_id, person_id, role_type)
- `fk_tpr_title` - FK(title_id) → title(title_id) ON DELETE CASCADE
- `fk_tpr_person` - FK(person_id) → person(person_id) ON DELETE CASCADE

**Purpose**: Maps people to titles with their roles

**Data**: 25 cast/crew entries loaded

---

### 7. **user_rating** - User Ratings and Reviews

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_rating_id | INT | PK, AUTO_INCREMENT | Unique rating identifier |
| user_id | INT | NOT NULL, FK | Reference to app_user |
| title_id | INT | NOT NULL, FK | Reference to title |
| rating_value | INT | NOT NULL, CHECK 1-10 | User's rating (1-10 stars) |
| rated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the rating was created |
| review_text | TEXT | NULL | Optional review comment |

**Constraints**:
- `uq_user_title` - UNIQUE(user_id, title_id) - One rating per user per title
- `fk_rating_user` - FK(user_id) → app_user(user_id) ON DELETE CASCADE
- `fk_rating_title` - FK(title_id) → title(title_id) ON DELETE CASCADE
- `chk_rating_value` - CHECK(rating_value BETWEEN 1 AND 10)

**Indexes**:
- PRIMARY KEY (user_rating_id)
- idx_user_rating_user_id (user_id)
- idx_user_rating_title_id (title_id)

**Data**: 23 user ratings from 4 demo users

---

## Views

### View 1: **v_title_overview**

**Purpose**: Denormalized view combining title info with genres and user ratings

**SELECT**:
```sql
SELECT
  t.title_id, t.imdb_tconst, t.primary_title, t.title_type,
  t.start_year, t.is_adult, t.runtime_minutes,
  GROUP_CONCAT(DISTINCT g.genre_name) AS genres,
  AVG(ur.rating_value) AS avg_user_rating,
  COUNT(ur.user_rating_id) AS user_rating_count,
  t.avg_rating AS imdb_avg_rating,
  t.num_votes
FROM title t
LEFT JOIN title_genre tg ON tg.title_id = t.title_id
LEFT JOIN genre_lookup g ON g.genre_id = tg.genre_id
LEFT JOIN user_rating ur ON ur.title_id = t.title_id
GROUP BY t.title_id, ...
```

**Used By**: Search endpoint, title detail endpoint

---

### View 2: **v_user_rating_history**

**Purpose**: Show user's rating history with title details

**SELECT**:
```sql
SELECT
  u.user_id, u.username,
  t.title_id, t.primary_title,
  ur.rating_value, ur.review_text, ur.rated_at
FROM app_user u
JOIN user_rating ur ON ur.user_id = u.user_id
JOIN title t ON t.title_id = ur.title_id
```

**Used By**: Rating history endpoint (with window function enhancement)

---

## Relationships Summary

| Relationship | Type | Cardinality | Constraint |
|--------------|------|-------------|-----------|
| app_user → user_rating | One-to-Many | 1:N | FK: user_id |
| title → user_rating | One-to-Many | 1:N | FK: title_id |
| title → title_genre | One-to-Many | 1:N | FK: title_id |
| genre_lookup → title_genre | One-to-Many | 1:N | FK: genre_id |
| title → title_person_role | One-to-Many | 1:N | FK: title_id |
| person → title_person_role | One-to-Many | 1:N | FK: person_id |

---

## Key Design Decisions

### 1. **Normalization Strategy**
- **Third Normal Form (3NF)**: All non-key attributes depend on the primary key
- **Junction Tables**: Separate tables for many-to-many relationships
- **Lookup Table**: genre_lookup prevents data duplication

### 2. **Foreign Key Strategy**
- **ON DELETE CASCADE** for title → user_rating, title → title_genre, title → title_person_role
- **ON DELETE RESTRICT** for genre_lookup (prevents accidental genre deletion)
- All FKs are NOT NULL to enforce referential integrity

### 3. **Constraint Strategy**
- **UNIQUE constraints**: Prevent duplicate usernames, emails, IMDb IDs
- **CHECK constraints**: Enforce business rules (rating 1-10, year >= 1870)
- **PRIMARY KEY constraints**: Auto-increment for all tables

### 4. **Indexing Strategy**
- **Composite Index**: (title_type, start_year) for search filtering
- **Single Column Indexes**: Foreign keys (user_id, title_id, genre_id) for JOINs
- **Text Index**: Primary_title (100 chars) for keyword search

---

## Data Flow Example

### Scenario: User Alice rates "The Corbett-Fitzsimmons Fight"

1. **User clicks title** → `GET /api/titles/2`
2. **Query joins**: title → title_genre → genre_lookup → user_rating
3. **Response includes**:
   - Title: "The Corbett-Fitzsimmons Fight"
   - Genres: Documentary, News, Sport
   - User ratings: 2 ratings (avg 9.0)
   
4. **User submits rating** → `POST /api/users/1/rate`
5. **INSERT**: user_rating (user_id=1, title_id=2, rating_value=9, review_text='Great!')
6. **View updated**: v_title_overview now shows avg_user_rating=9.0, user_rating_count=2

---

## Migration & Schema Evolution

### Initial Schema Deployment
```sql
-- Run in order:
1. CREATE TABLE app_user
2. CREATE TABLE title
3. CREATE TABLE person
4. CREATE TABLE genre_lookup
5. CREATE TABLE title_genre (depends on: title, genre_lookup)
6. CREATE TABLE title_person_role (depends on: title, person)
7. CREATE TABLE user_rating (depends on: app_user, title)
8. CREATE VIEWS v_title_overview, v_user_rating_history
9. CREATE INDEXES (all tables)
10. CREATE STORED PROCEDURE get_recommendations_for_user
```

### Deployment Method
```bash
docker exec imdb-mysql mysql -u imdb_user -pimdb_pass imdb_app < sql/01_init_imdb_app.sql
```

---

**Document Version**: 1.0  
**Last Updated**: December 2, 2025  
**Schema Compliance**: MySQL 8.0 Standard
