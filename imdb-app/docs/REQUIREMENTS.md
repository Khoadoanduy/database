# IMDb Recommendations App - Requirements Document

## Executive Summary

The IMDb Recommendations App is a full-stack web application demonstrating advanced SQL database design, complex queries, and modern web development practices. The application enables users to search for movies/TV series, view detailed information with cast/crew, rate titles, and receive personalized recommendations based on their viewing history.

**Status**: ✅ Production Ready | **Version**: 1.0.0

---

## 1. Functional Requirements

### 1.1 User Management
- **FR-1.1**: Users can view a list of all registered users
- **FR-1.2**: Users can select themselves to access personalized features
- **FR-1.3**: System supports 4 demo user accounts (alice, bob, carol, demo_user)
- **FR-1.4**: Each user has unique username and email with UNIQUE constraints

### 1.2 Title Search & Discovery
- **FR-2.1**: Users can search titles by keyword
- **FR-2.2**: Users can filter by year range (year_from, year_to)
- **FR-2.3**: Users can filter by type (movie, tvSeries, tvMovie)
- **FR-2.4**: Users can filter by genre
- **FR-2.5**: Results sorted by user rating (descending) then popularity
- **FR-2.6**: Search results limited to 50 entries to prevent performance issues
- **FR-2.7**: Results display IMDb title, genres, year, runtime, and avg user rating

### 1.3 Title Details & Cast/Crew
- **FR-3.1**: Users can click on any title to view full details
- **FR-3.2**: Details include: primary title, year, type, runtime, genres
- **FR-3.3**: Cast & crew displayed organized by role (actor, director, writer, producer)
- **FR-3.4**: User reviews shown with rating stars and timestamps
- **FR-3.5**: Modal dialog displays title details without page refresh

### 1.4 User Ratings & Reviews
- **FR-4.1**: Users can rate any title from 1-10 stars
- **FR-4.2**: Users can optionally write review text (max 500 chars)
- **FR-4.3**: Rating includes timestamp (auto-generated)
- **FR-4.4**: Users can update their rating for a title (via ON DUPLICATE KEY UPDATE)
- **FR-4.5**: System prevents invalid ratings (< 1 or > 10)
- **FR-4.6**: User can only rate each title once (UNIQUE constraint on user_id, title_id)

### 1.5 Analytics & Recommendations
- **FR-5.1**: Users can view top genres by average user rating
- **FR-5.2**: Top genres query requires minimum 2 ratings per genre
- **FR-5.3**: Genres sorted by average rating (descending)
- **FR-5.4**: Users can get personalized recommendations based on favorite genres
- **FR-5.5**: Recommendations exclude titles user has already rated
- **FR-5.6**: Recommendations based on titles rated >= 8 stars
- **FR-5.7**: Recommendations sorted by IMDb rating (highest first)

### 1.6 Rating History
- **FR-6.1**: Users can view their complete rating history
- **FR-6.2**: History shows title, rating, review, and timestamp
- **FR-6.3**: Ratings sorted by most recent first
- **FR-6.4**: Ratings include ranking position (window function)

---

## 2. Non-Functional Requirements

### 2.1 Database Requirements
- **NFR-1.1**: MySQL 8.0+ with InnoDB storage engine
- **NFR-1.2**: Database character set: utf8mb4 (supports emoji, special chars)
- **NFR-1.3**: Collation: utf8mb4_unicode_ci (case-insensitive)
- **NFR-1.4**: Connection pooling with max 10 concurrent connections
- **NFR-1.5**: Query timeout: 30 seconds max

### 2.2 Performance Requirements
- **NFR-2.1**: Search queries complete within 2 seconds
- **NFR-2.2**: Title details load within 500ms
- **NFR-2.3**: Top genres query within 5 seconds
- **NFR-2.4**: Recommendations within 2 seconds
- **NFR-2.5**: Support minimum 1000 concurrent users
- **NFR-2.6**: Index optimization required for frequently accessed fields

### 2.3 Security Requirements
- **NFR-3.1**: SQL injection prevention via parameterized queries
- **NFR-3.2**: Input validation on all user inputs
- **NFR-3.3**: Rating values validated as integers between 1-10
- **NFR-3.4**: No passwords stored (demo app, no authentication)
- **NFR-3.5**: CORS enabled for local development

### 2.4 Data Integrity Requirements
- **NFR-4.1**: Foreign key constraints prevent orphaned records
- **NFR-4.2**: ON DELETE CASCADE for title deletions
- **NFR-4.3**: UNIQUE constraints prevent duplicate usernames/emails
- **NFR-4.4**: CHECK constraints enforce business rules (rating 1-10, year >= 1870)
- **NFR-4.5**: Primary keys auto-increment for all tables

### 2.5 Availability & Reliability
- **NFR-5.1**: 99.5% uptime SLA for demonstration
- **NFR-5.2**: Graceful error handling with meaningful error messages
- **NFR-5.3**: Database connection failures display user-friendly message
- **NFR-5.4**: Invalid operations return HTTP 400/404 status codes

---

## 3. Data Requirements

### 3.1 Data Sources
- **Title Data**: IMDb title.basics.tsv (264 titles loaded)
- **People Data**: IMDb name.basics.tsv (4,990 people loaded)
- **Rating Data**: IMDb title.ratings.tsv (avg_rating, num_votes)
- **Cast/Crew Data**: IMDb title.principals.tsv (25 entries loaded)
- **Genre Data**: Predefined list of 27 IMDb standard genres

### 3.2 Data Constraints
- Minimum 2 ratings required for genre aggregation
- Titles must have start_year >= 1870
- Runtime must be > 0 minutes (if specified)
- Rating values between 1-10 inclusive
- Username cannot be empty string
- Death year >= birth year (if both specified)

### 3.3 Data Quality
- All special characters properly escaped (apostrophes, quotes, unicode)
- Null values handled correctly (\N in TSV converted to NULL)
- Duplicate records prevented via UNIQUE constraints
- Data normalized to 3NF (Third Normal Form)

---

## 4. API Specifications

### 4.1 REST Endpoints

| Method | Endpoint | Parameters | Returns | Status |
|--------|----------|-----------|---------|--------|
| GET | `/api/titles/search` | keyword, year_from, year_to, type, genre | Array of titles | ✅ |
| GET | `/api/titles/:titleId` | titleId | Title object with cast/ratings | ✅ |
| GET | `/api/genres/top` | None | Array of genres with ratings | ✅ |
| GET | `/api/users/:userId/rating-history` | userId | Array of ratings with ranking | ✅ |
| GET | `/api/users/:userId/recommendations` | userId, limit | Array of recommendations | ✅ |
| POST | `/api/users/:userId/rate` | userId, titleId, ratingValue, reviewText | Success response | ✅ |
| GET | `/api/users` | None | Array of all users | ✅ |
| GET | `/api/genres` | None | Array of all genres | ✅ |
| GET | `/api/health` | None | Status message | ✅ |

### 4.2 Request/Response Examples

```json
// GET /api/titles/search?keyword=corbett
{
  "title_id": 2,
  "imdb_tconst": "tt0000147",
  "primary_title": "The Corbett-Fitzsimmons Fight",
  "start_year": 1897,
  "title_type": "movie",
  "runtime_minutes": 100,
  "genres": "Documentary, News, Sport",
  "avg_user_rating": 9.0,
  "user_rating_count": 2,
  "imdb_avg_rating": 5.3,
  "num_votes": 577
}
```

```json
// POST /api/users/1/rate
{
  "titleId": 5,
  "ratingValue": 9,
  "reviewText": "Great film!"
}

// Response:
{
  "success": true,
  "message": "Rating saved successfully"
}
```

---

## 5. User Personas & Stories

### Persona 1: Movie Enthusiast (Alice)
- **Goal**: Discover new films matching personal taste
- **Story**: "As a movie enthusiast, I want to search for drama films from 2000-2010 and see top-rated ones first"
- **Success Criteria**: ✅ Can filter by genre and year, results sorted by rating

### Persona 2: Casual Viewer (Bob)
- **Goal**: Rate movies watched and see what others liked
- **Story**: "As a casual viewer, I want to rate a movie and see recommendations based on my ratings"
- **Success Criteria**: ✅ Can submit rating, receives genre-based recommendations

### Persona 3: Data Analyst (Carol)
- **Goal**: Analyze rating trends and genre popularity
- **Story**: "As an analyst, I want to see which genres are most highly rated by users"
- **Success Criteria**: ✅ Top genres endpoint shows aggregated user ratings with HAVING clause

---

## 6. Compliance & Standards

- **SQL Standard**: MySQL 8.0 SQL Standard Compliance
- **REST API**: RESTful architecture with JSON responses
- **Accessibility**: WCAG 2.1 AA standard (semantic HTML, keyboard navigation)
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+
- **Data Privacy**: Demo app, no PII collection

---

## 7. Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Database Tables | >= 4 | 7 | ✅ |
| Foreign Keys | >= 4 | 7 | ✅ |
| UNIQUE Constraints | >= 1 | 5 | ✅ |
| CHECK Constraints | >= 2 | 3 | ✅ |
| SQL Queries | >= 10 | 10 | ✅ |
| Views | >= 2 | 2 | ✅ |
| Stored Procedures | >= 1 | 1 | ✅ |
| Indexes | >= 4 | 5 | ✅ |
| API Endpoints | >= 5 | 9 | ✅ |
| Test Cases | >= 5 | 6 | ✅ |

---

## 8. Timeline & Milestones

| Phase | Target | Status |
|-------|--------|--------|
| Database Design | Week 1 | ✅ Complete |
| Data Loading (264 titles, 4,990 people) | Week 2 | ✅ Complete |
| Backend API Development | Week 2 | ✅ Complete |
| Frontend UI Implementation | Week 3 | ✅ Complete |
| Testing & QA | Week 3 | ✅ Complete |
| Documentation | Week 4 | ✅ In Progress |
| Deployment | Week 4 | ✅ Ready |

---

## 9. Known Limitations

1. **Sample Data**: 264 titles vs. 10M+ titles in production IMDb
2. **No Authentication**: Demo app, no user login/password system
3. **Limited Concurrency**: Connection pool of 10 (production: 100+)
4. **Single Database Server**: No replication/failover in demo
5. **No Caching**: Every query hits database (production: Redis/Memcached)
6. **No Pagination**: Limited to 50 search results (production: 10-25 per page)

---

## 10. Future Enhancements

- [ ] User authentication & authorization
- [ ] Advanced search with Elasticsearch
- [ ] Real-time notifications for new ratings
- [ ] Machine learning recommendations
- [ ] Admin dashboard for content management
- [ ] API rate limiting & throttling
- [ ] Full-text search with ranking
- [ ] Social features (follow users, share reviews)
- [ ] Mobile app (iOS/Android)
- [ ] CDN for static assets

---

**Document Version**: 1.0  
**Last Updated**: December 2, 2025  
**Author**: Database Systems Project Team
