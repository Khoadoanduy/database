# IMDb Datasets Used

This document describes all IMDb dataset files used in the application, their purposes, and field structures.

## Overview

The application uses IMDb (Internet Movie Database) datasets in TSV (Tab-Separated Values) format. All datasets are located in the `Data/` directory and are loaded into MySQL database tables.

**Data Format**: Tab-Separated Values (TSV) files with UTF-8 encoding  
**NULL Values**: Represented as `\N` in the datasets  
**Data Quality**: Handles NULL values, special characters, and enforces referential integrity

---

## Dataset Files

### 1. **name.basics.tsv** 👥

**Purpose**: Contains personal information about actors, directors, writers, and other industry professionals.

**Fields** (in order):
| Field | Type | Description | Used |
|-------|------|-------------|------|
| `nconst` | VARCHAR(12) | IMDb name identifier (e.g., nm0000001) | ✅ Primary Key |
| `primaryName` | TEXT | Person's primary name | ✅ Stored |
| `birthYear` | INT | Birth year (NULL if unknown) | ✅ Stored |
| `deathYear` | INT | Death year (NULL if alive/unknown) | ✅ Stored |
| `primaryProfession` | TEXT | Comma-separated professions | ❌ Not used |
| `knownForTitles` | TEXT | Comma-separated title IDs | ❌ Not used |

**Database Table**: `person`  
**Records Loaded**: Up to 50,000 people (configurable)  
**Key Usage**: Links people to titles via `title_person_role` table

---

### 2. **title.basics.tsv** 🎬

**Purpose**: Core title information including movies, TV series, TV movies, and episodes.

**Fields** (in order):
| Field | Type | Description | Used |
|-------|------|-------------|------|
| `tconst` | VARCHAR(12) | IMDb title identifier (e.g., tt0000001) | ✅ Primary Key |
| `titleType` | VARCHAR(20) | Type: movie, tvSeries, tvMovie, tvEpisode, tvMiniSeries | ✅ Filtered & Stored |
| `primaryTitle` | TEXT | Primary title name | ✅ Stored |
| `originalTitle` | TEXT | Original title (if different) | ❌ Not used |
| `isAdult` | TINYINT(1) | Adult content flag (0 or 1) | ✅ Stored |
| `startYear` | INT | Release/start year (NULL if unknown) | ✅ Stored |
| `endYear` | INT | End year (for TV series) | ❌ Not used |
| `runtimeMinutes` | INT | Runtime in minutes (NULL if unknown) | ✅ Stored |
| `genres` | TEXT | Comma-separated genre list | ✅ Parsed & Linked |

**Database Table**: `title`  
**Records Loaded**: Up to 20,000 titles (configurable)  
**Filtering**: Only loads `movie`, `tvSeries`, `tvMovie`, `tvEpisode`, `tvMiniSeries`  
**Key Usage**: Main entity for all title-related queries

---

### 3. **title.ratings.tsv** ⭐

**Purpose**: IMDb user ratings and vote counts for titles.

**Fields** (in order):
| Field | Type | Description | Used |
|-------|------|-------------|------|
| `tconst` | VARCHAR(12) | IMDb title identifier | ✅ Foreign Key |
| `averageRating` | DECIMAL(3,1) | Average rating (0.0-10.0) | ✅ Stored |
| `numVotes` | INT | Number of votes | ✅ Stored |

**Database Table**: `title` (updates `avg_rating` and `num_votes` columns)  
**Records Loaded**: All ratings for loaded titles  
**Key Usage**: Provides IMDb ratings displayed alongside user ratings

---

### 4. **title.principals.tsv** 🎭

**Purpose**: Cast and crew information linking people to titles with their roles and character names.

**Fields** (in order):
| Field | Type | Description | Used |
|-------|------|-------------|------|
| `tconst` | VARCHAR(12) | IMDb title identifier | ✅ Foreign Key |
| `ordering` | INT | Ordering of person for this title | ❌ Not used |
| `nconst` | VARCHAR(12) | IMDb name identifier | ✅ Foreign Key |
| `category` | VARCHAR(30) | Role category | ✅ Mapped to role_type |
| `job` | TEXT | Specific job title | ❌ Not used |
| `characters` | TEXT | Character name(s) in JSON array format | ✅ Stored (cleaned) |

**Role Categories Used**:
- `actor` / `actress` → mapped to `actor`
- `director` → `director`
- `writer` → `writer`
- `producer` → `producer`
- `composer` → `composer`
- `cinematographer` → `cinematographer`
- `editor` → `editor`

**Database Table**: `title_person_role`  
**Records Loaded**: Up to 200,000 cast/crew entries (configurable)  
**Key Usage**: Creates relationships between titles and people with role types and character names

**Character Data**: The `characters` field is parsed from JSON array format (e.g., `["Character Name"]`) and stored as plain text.

---

### 5. **title.crew.tsv** 🎬 (Optional)

**Purpose**: Additional crew data specifically for directors and writers (complements title.principals.tsv).

**Fields** (in order):
| Field | Type | Description | Used |
|-------|------|-------------|------|
| `tconst` | VARCHAR(12) | IMDb title identifier | ✅ Foreign Key |
| `directors` | TEXT | Comma-separated list of director nconsts | ✅ Processed |
| `writers` | TEXT | Comma-separated list of writer nconsts | ✅ Processed |

**Database Table**: `title_person_role` (adds director/writer entries)  
**Records Loaded**: Up to 50,000 crew entries (configurable)  
**Status**: Optional - script continues if file not found  
**Key Usage**: Ensures comprehensive director and writer coverage

---

## Dataset Relationships

```
name.basics.tsv (people)
    ↓
title.principals.tsv (cast/crew) ←→ title.basics.tsv (titles)
    ↓                                    ↓
title_person_role                    title_genre
    ↓                                    ↓
title.crew.tsv (crew) ─────────────→ title.ratings.tsv
```

---

## Data Loading Process

1. **Genres** → Load genre lookup table (27 standard genres)
2. **People** → Load from `name.basics.tsv` (up to 50k records)
3. **Titles** → Load from `title.basics.tsv` (up to 20k records)
4. **Ratings** → Update titles with ratings from `title.ratings.tsv`
5. **Genres** → Link titles to genres from `title.basics.tsv` genres field
6. **Cast/Crew** → Load from `title.principals.tsv` (up to 200k records)
7. **Crew** → Load additional crew from `title.crew.tsv` (optional, up to 50k records)
8. **User Ratings** → Generate sample user ratings for loaded titles
