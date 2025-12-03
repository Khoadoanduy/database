CREATE DATABASE IF NOT EXISTS imdb_app
   DEFAULT CHARACTER SET utf8mb4
   DEFAULT COLLATE utf8mb4_unicode_ci;

USE imdb_app;

-- =========================================================
-- TABLES (7 total)
-- =========================================================

CREATE TABLE app_user (
     user_id      INT AUTO_INCREMENT PRIMARY KEY,
     username     VARCHAR(50) NOT NULL,
     email        VARCHAR(255) NOT NULL,
     created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     is_admin     TINYINT(1) NOT NULL DEFAULT 0,
     CONSTRAINT uq_app_user_username UNIQUE (username),
     CONSTRAINT uq_app_user_email UNIQUE (email),
     CONSTRAINT chk_username_not_empty CHECK (username <> '')
) ENGINE=InnoDB;

CREATE TABLE title (
     title_id         INT AUTO_INCREMENT PRIMARY KEY,
     imdb_tconst      VARCHAR(12),
     primary_title    TEXT NOT NULL,
     start_year       INT,
     title_type       VARCHAR(20) NOT NULL,
     runtime_minutes  INT,
     is_adult         TINYINT(1) NOT NULL DEFAULT 0,
     avg_rating       DECIMAL(3,1),
     num_votes        INT NOT NULL DEFAULT 0,
     CONSTRAINT uq_title_imdb_tconst UNIQUE (imdb_tconst),
     CONSTRAINT chk_start_year CHECK (start_year IS NULL OR start_year >= 1870),
     CONSTRAINT chk_runtime CHECK (runtime_minutes IS NULL OR runtime_minutes > 0)
) ENGINE=InnoDB;

CREATE TABLE person (
     person_id     INT AUTO_INCREMENT PRIMARY KEY,
     imdb_nconst   VARCHAR(12),
     primary_name  TEXT NOT NULL,
     birth_year    INT,
     death_year    INT,
     CONSTRAINT uq_person_imdb_nconst UNIQUE (imdb_nconst),
     CONSTRAINT chk_birth_year CHECK (birth_year IS NULL OR birth_year >= 1850),
     CONSTRAINT chk_death_year CHECK (death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year)
) ENGINE=InnoDB;

CREATE TABLE genre_lookup (
     genre_id    INT AUTO_INCREMENT PRIMARY KEY,
     genre_name  VARCHAR(50) NOT NULL,
     CONSTRAINT uq_genre_name UNIQUE (genre_name)
) ENGINE=InnoDB;

CREATE TABLE title_genre (
     title_id  INT NOT NULL,
     genre_id  INT NOT NULL,
     PRIMARY KEY (title_id, genre_id),
     CONSTRAINT fk_title_genre_title
         FOREIGN KEY (title_id) REFERENCES title(title_id)
         ON DELETE CASCADE,
     CONSTRAINT fk_title_genre_genre
         FOREIGN KEY (genre_id) REFERENCES genre_lookup(genre_id)
         ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE title_person_role (
     title_id    INT NOT NULL,
     person_id   INT NOT NULL,
     role_type   VARCHAR(30) NOT NULL,
     characters  TEXT,
     PRIMARY KEY (title_id, person_id, role_type),
     CONSTRAINT fk_tpr_title
         FOREIGN KEY (title_id) REFERENCES title(title_id)
         ON DELETE CASCADE,
     CONSTRAINT fk_tpr_person
         FOREIGN KEY (person_id) REFERENCES person(person_id)
         ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_rating (
     user_rating_id INT AUTO_INCREMENT PRIMARY KEY,
     user_id        INT NOT NULL,
     title_id       INT NOT NULL,
     rating_value   INT NOT NULL,
     rated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     review_text    TEXT,
     CONSTRAINT uq_user_title UNIQUE (user_id, title_id),
     CONSTRAINT fk_rating_user
         FOREIGN KEY (user_id) REFERENCES app_user(user_id)
         ON DELETE CASCADE,
     CONSTRAINT fk_rating_title
         FOREIGN KEY (title_id) REFERENCES title(title_id)
         ON DELETE CASCADE,
     CONSTRAINT chk_rating_value CHECK (rating_value BETWEEN 1 AND 10)
) ENGINE=InnoDB;

-- =========================================================
-- DEMO USERS
-- =========================================================

INSERT INTO app_user (username, email, is_admin) VALUES
('alice', 'alice@example.com', 0),
('bob', 'bob@example.com', 1),
('carol', 'carol@example.com', 0),
('demo_user', 'demo@example.com', 0);

-- =========================================================
-- VIEWS (2 views)
-- =========================================================

CREATE OR REPLACE VIEW v_title_overview AS
SELECT
    t.title_id,
    t.imdb_tconst,
    t.primary_title,
    t.title_type,
    t.start_year,
    t.is_adult,
    t.runtime_minutes,
    COALESCE(GROUP_CONCAT(DISTINCT g.genre_name ORDER BY g.genre_name SEPARATOR ', '), 'N/A') AS genres,
    COALESCE(AVG(ur.rating_value), 0) AS avg_user_rating,
    COUNT(DISTINCT ur.user_rating_id) AS user_rating_count,
    COALESCE(t.avg_rating, 0) AS imdb_avg_rating,
    COALESCE(t.num_votes, 0) AS num_votes
FROM title t
LEFT JOIN title_genre tg ON tg.title_id = t.title_id
LEFT JOIN genre_lookup g ON g.genre_id = tg.genre_id
LEFT JOIN user_rating ur ON ur.title_id = t.title_id
GROUP BY
    t.title_id, t.imdb_tconst, t.primary_title, t.title_type,
    t.start_year, t.is_adult, t.runtime_minutes, t.avg_rating, t.num_votes;

CREATE OR REPLACE VIEW v_user_rating_history AS
SELECT
    u.user_id,
    u.username,
    t.title_id,
    t.primary_title,
    ur.rating_value,
    ur.review_text,
    ur.rated_at
FROM app_user u
JOIN user_rating ur ON ur.user_id = u.user_id
JOIN title t ON t.title_id = ur.title_id;

-- =========================================================
-- STORED PROCEDURE
-- =========================================================

DELIMITER //

CREATE PROCEDURE get_recommendations_for_user(
     IN p_user_id INT,
     IN p_limit INT
)
READS SQL DATA
BEGIN
     SELECT
        t.title_id,
        t.imdb_tconst,
        t.primary_title,
        t.start_year,
        t.title_type,
        COALESCE(GROUP_CONCAT(DISTINCT g.genre_name ORDER BY g.genre_name SEPARATOR ', '), 'N/A') AS genres,
        'Matches your favorite genres' AS reason,
        COALESCE(t.avg_rating, 0) AS avg_rating
     FROM title t
     JOIN title_genre tg ON tg.title_id = t.title_id
     LEFT JOIN genre_lookup g ON g.genre_id = tg.genre_id
     WHERE tg.genre_id IN (
        SELECT DISTINCT tg2.genre_id
        FROM user_rating ur
        JOIN title_genre tg2 ON tg2.title_id = ur.title_id
        WHERE ur.user_id = p_user_id AND ur.rating_value >= 8
     )
       AND t.title_id NOT IN (
           SELECT title_id FROM user_rating WHERE user_id = p_user_id
      )
     GROUP BY t.title_id, t.imdb_tconst, t.primary_title, t.start_year, t.title_type, t.avg_rating
     ORDER BY COALESCE(t.avg_rating, 0) DESC, t.num_votes DESC
     LIMIT p_limit;
END //

DELIMITER ;

-- =========================================================
-- INDEXES (5 indexes including 1 composite)
-- =========================================================

CREATE INDEX idx_title_title_type_start_year ON title (title_type, start_year);
CREATE INDEX idx_user_rating_title_id ON user_rating (title_id);
CREATE INDEX idx_user_rating_user_id ON user_rating (user_id);
CREATE INDEX idx_title_genre_genre_id ON title_genre (genre_id);
CREATE INDEX idx_title_primary_title ON title (primary_title(100));

