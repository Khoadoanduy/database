# IMDb Recommendations App - Complete Documentation

## 🎯 Project Overview

**Status**: ✅ **PRODUCTION READY**

The IMDb Recommendations App is a full-stack web application demonstrating advanced SQL database design, complex queries, and modern web development practices. Users can search for movies/TV series, rate titles, and receive personalized recommendations.

### Quick Stats
- **Database Tables**: 7 (with 2 views, 1 stored procedure)
- **Real Data Loaded**: 264 titles, 4,990 people, 27 genres
- **User Ratings**: 23 (from 4 demo users)
- **Indexes**: 5 (1 composite, 4 single-column)
- **Performance**: 78% faster than SLA requirements
- **Test Coverage**: 25 test cases, 100% pass rate

---

## 📚 Documentation Files

### 1. **REQUIREMENTS.md** (264 lines)
Comprehensive requirements document covering:
- ✅ 10 functional requirements with success criteria
- ✅ 5 categories of non-functional requirements
- ✅ Data specifications and constraints
- ✅ 9 REST API endpoints with examples
- ✅ 3 user personas with user stories
- ✅ 10 success metrics (all achieved)

**Key Highlights**:
- All 10 functional requirements: ✅ IMPLEMENTED
- All 5 non-functional requirements: ✅ MET
- API endpoints: 9/9 working (✅ 100%)

---

### 2. **ERD.md** (372 lines)
Complete Entity-Relationship Diagram with:
- ✅ ASCII diagram showing all 7 tables and relationships
- ✅ Detailed table specifications with constraints
- ✅ 2 views (v_title_overview, v_user_rating_history)
- ✅ 1 stored procedure (get_recommendations_for_user)
- ✅ Key design decisions and migration strategy
- ✅ Data flow example with real scenario

**Database Design**:
- **Normalization**: 3NF (Third Normal Form)
- **Foreign Keys**: 7 total with ON DELETE CASCADE/RESTRICT
- **UNIQUE Constraints**: 5 total (preventing duplicates)`
- **CHECK Constraints**: 3 total (enforcing business rules)

---

### 3. **TEST_PLAN.md** (532 lines)
Comprehensive testing with 25 test cases:

**Test Results**:
- ✅ 8 Positive Tests (100% pass)
- ✅ 7 Negative Tests (100% pass)
- ✅ 3 Data Integrity Tests (100% pass)
- ✅ 5 Performance Tests (100% pass)
- ✅ 2 API Contract Tests (100% pass)

**Overall Pass Rate**: 25/25 = **100% ✅**

**Performance Achievements**:
- Search Query: 0.35 sec (SLA: 2 sec) - **82.5% faster**
- Title Details: 0.28 sec (SLA: 500ms) - **44% faster**
- Top Genres: 0.45 sec (SLA: 5 sec) - **91% faster**
- Rating History: 0.12 sec (SLA: 1 sec) - **88% faster**
- Recommendations: 0.38 sec (SLA: 2 sec) - **81% faster**

---

### 4. **PERFORMANCE.md** (616 lines)
Production-ready optimization guide:
- ✅ Indexing strategy (5 indexes, 1 composite)
- ✅ Query execution plans with EXPLAIN analysis
- ✅ Connection pool optimization (10 demo, 50+ production)
- ✅ Caching strategies (application-level, Redis, materialization)
- ✅ Query optimization techniques (denormalization, subqueries)
- ✅ Concurrency & transaction isolation
- ✅ Scalability analysis (1M to 100M+ users)
- ✅ Production deployment recommendations

**Key Metrics**:
- Average performance vs SLA: **78% faster** ✅
- Database size: 15 MB (easily fits in RAM)
- Index coverage: **100%** on foreign keys
- All queries use indexes: ✅ VERIFIED

---

## 🚀 Quick Start

### 1. Start Docker Database
```bash
cd /Users/doankhoa/Documents/Fall\ 25/Database\ systems/imdb-app
docker-compose up -d
```

### 2. Load Data (Optional - already loaded)
```bash
bash load_data.sh
```

### 3. Start Node.js Server
```bash
npm start
```

### 4. Access Application
```
http://localhost:3000
```

---

## 📊 Database Schema Summary

### 7 Tables
1. **app_user** - Demo users (4 users)
2. **title** - Movies/TV series (264 titles)
3. **person** - Actors/directors/writers (4,990 people)
4. **genre_lookup** - Genre reference (27 genres)
5. **title_genre** - Title-genre mapping (167 links)
6. **title_person_role** - Cast/crew mapping (25 entries)
7. **user_rating** - User ratings (23 ratings)

### 2 Views
- **v_title_overview** - Denormalized title with genres and ratings
- **v_user_rating_history** - User's rating history with titles

### 1 Stored Procedure
- **get_recommendations_for_user** - Personalized recommendations based on favorite genres

### 5 Indexes
- `idx_title_title_type_start_year` (COMPOSITE: title_type, start_year)
- `idx_user_rating_user_id` (user_id for JOINs)
- `idx_user_rating_title_id` (title_id for JOINs)
- `idx_title_genre_genre_id` (genre_id for JOINs)
- `idx_title_primary_title` (primary_title(100) for search)

---

## 🎓 Featured SQL Concepts

### 1. **Multi-Table Joins** (Q2)
```sql
SELECT title, genres, cast, ratings
FROM title
  LEFT JOIN title_genre ON title.id = title_genre.title_id
  LEFT JOIN genre_lookup ON ...
  LEFT JOIN user_rating ON ...
  LEFT JOIN app_user ON ...
```

### 2. **Aggregation Queries** (Q3)
```sql
SELECT genre_name, AVG(rating_value), COUNT(*)
FROM genre_lookup
GROUP BY genre_name
HAVING COUNT(*) >= 2
ORDER BY avg_rating DESC
```

### 3. **Window Functions** (Q7)
```sql
SELECT *,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY rated_at DESC) AS rank
FROM user_rating
```

### 4. **Stored Procedures** (Q9)
```sql
CREATE PROCEDURE get_recommendations_for_user(user_id INT, limit INT)
  -- Complex business logic with subqueries and filtering
```

### 5. **Foreign Key Constraints**
```sql
-- ON DELETE CASCADE for title → user_rating, title_genre, title_person_role
-- ON DELETE RESTRICT for genre_lookup
```

### 6. **Check Constraints**
```sql
-- rating_value BETWEEN 1 AND 10
-- start_year >= 1870
-- runtime_minutes > 0
```

### 7. **Unique Constraints**
```sql
-- UNIQUE(username), UNIQUE(email), UNIQUE(imdb_tconst)
-- UNIQUE(user_id, title_id) - one rating per user per title
```

---

## 🔍 API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/titles/search` | GET | Search titles by keyword, year, type, genre
| `/api/titles/:id` | GET | Get title details with cast, genres, ratings
| `/api/genres/top` | GET | Get top genres by average user rating
| `/api/users/:id/rating-history` | GET | Get user's rating history with rankings
| `/api/users/:id/recommendations` | GET | Get personalized recommendations
| `/api/users/:id/rate` | POST | Submit a rating for a title
| `/api/users` | GET | Get list of all users
| `/api/genres` | GET | Get list of all genres
| `/api/health` | GET | Health check endpoint

---

## ✅ Verification Checklist

### Database Design
- [x] 7 tables (minimum 4 required)
- [x] 2 views (minimum 2 required)
- [x] 1 stored procedure (minimum 1 required)
- [x] 7 foreign keys (minimum 4 required)
- [x] 5 unique constraints (minimum 1 required)
- [x] 3 check constraints (minimum 2 required)
- [x] 5 indexes (minimum 4 required)

### SQL Queries Demonstrated
- [x] Q1: Search & filtering with WHERE, LIKE, LIMIT
- [x] Q2: Multi-table joins (5 tables)
- [x] Q3: GROUP BY, aggregation (AVG, COUNT), HAVING
- [x] Q4: INSERT/UPDATE with ON DUPLICATE KEY
- [x] Q5: DELETE with cascading
- [x] Q6: Subqueries and nested conditions
- [x] Q7: Window functions (ROW_NUMBER, PARTITION BY)
- [x] Q8: DISTINCT, ORDER BY
- [x] Q9: Stored procedure with complex logic
- [x] Q10: Views with pre-computed aggregations

### Data & Testing
- [x] Real data loaded (264 titles, 4,990 people)
- [x] 25 test cases (100% pass rate)
- [x] Performance testing (78% faster than SLA)
- [x] Security testing (SQL injection prevention)
- [x] Data integrity testing (constraint enforcement)

### Documentation
- [x] REQUIREMENTS.md (264 lines)
- [x] ERD.md with detailed schema (372 lines)
- [x] TEST_PLAN.md with 25 test cases (532 lines)
- [x] PERFORMANCE.md with optimization guide (616 lines)
- [x] README.md (this file)

---

## 📈 Performance Summary

**Overall Status**: ✅ **EXCELLENT**

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| Query Performance | 78% faster | SLA ✅ | Excellent |
| Test Pass Rate | 100% | 95%+ | Excellent |
| Code Coverage | 10 SQL queries | 10 required | ✅ Complete |
| Database Constraints | 15 total | 7 required | ✅ Exceeds |
| Documentation | 1,784 lines | Comprehensive | ✅ Exceeds |

---

## 🎓 Learning Outcomes

This project demonstrates:

1. **Database Design**
   - Third Normal Form (3NF) normalization
   - Primary and foreign key relationships
   - Junction tables for many-to-many relationships
   - Constraint-based data integrity

2. **Advanced SQL**
   - Multi-table JOINs (INNER, LEFT, CROSS)
   - Aggregation queries with GROUP BY and HAVING
   - Window functions for ranking
   - Stored procedures with parameters
   - Views for query abstraction
   - Subqueries and derived tables

3. **Optimization**
   - Index design and strategy
   - Query execution plan analysis
   - Connection pool management
   - Caching strategies
   - Performance tuning

4. **Data Integrity**
   - Foreign key constraints with cascading
   - UNIQUE constraints preventing duplicates
   - CHECK constraints enforcing business rules
   - Transactions for consistency

5. **Web Development**
   - RESTful API design
   - Node.js/Express backend
   - HTML/CSS/JavaScript frontend
   - Docker containerization

