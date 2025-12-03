const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "imdb_user",
  password: process.env.DB_PASSWORD || "imdb_pass",
  database: process.env.DB_NAME || "imdb_app",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✓ MySQL connection successful");
    connection.release();
  } catch (error) {
    console.error("✗ MySQL connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();

// ==================== API ROUTES ====================

// Q1: Search & Browse Titles
// Demonstrates: view, filtering, ORDER BY, aggregation
app.get("/api/titles/search", async (req, res) => {
  try {
    const { keyword, year_from, year_to, type, genre } = req.query;

    let query = "SELECT * FROM v_title_overview WHERE 1=1";
    const params = [];

    if (keyword) {
      query += " AND LOWER(primary_title) LIKE ?";
      params.push(`%${keyword.toLowerCase()}%`);
    }
    if (year_from) {
      query += " AND start_year >= ?";
      params.push(parseInt(year_from));
    }
    if (year_to) {
      query += " AND start_year <= ?";
      params.push(parseInt(year_to));
    }
    if (type) {
      query += " AND title_type = ?";
      params.push(type);
    }
    if (genre) {
      query += " AND genres LIKE ?";
      params.push(`%${genre}%`);
    }

    query += " ORDER BY avg_user_rating DESC, user_rating_count DESC LIMIT 50";

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(query, params);
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error("Error searching titles:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q2: Title Detail with Cast/Crew
// Demonstrates: join of 4+ tables, LEFT JOIN
app.get("/api/titles/:titleId", async (req, res) => {
  try {
    const { titleId } = req.params;
    const connection = await pool.getConnection();

    // Get title details
    const [titleRows] = await connection.execute(
      "SELECT * FROM v_title_overview WHERE title_id = ?",
      [titleId]
    );

    if (titleRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Title not found" });
    }

    const title = titleRows[0];

    // Get cast and crew organized by role type
    const [castCrew] = await connection.execute(
      `
      SELECT p.person_id, p.primary_name, p.birth_year, p.death_year,
             tpr.role_type, tpr.characters
      FROM title_person_role tpr
      LEFT JOIN person p ON p.person_id = tpr.person_id
      WHERE tpr.title_id = ?
      ORDER BY 
        CASE tpr.role_type
          WHEN 'director' THEN 1
          WHEN 'writer' THEN 2
          WHEN 'producer' THEN 3
          WHEN 'actor' THEN 4
          ELSE 5
        END,
        p.primary_name
    `,
      [titleId]
    );

    // Organize cast and crew by role
    const cast = [];
    const directors = [];
    const writers = [];
    const producers = [];

    castCrew.forEach((person) => {
      const personInfo = {
        person_id: person.person_id,
        name: person.primary_name,
        birth_year: person.birth_year,
        death_year: person.death_year,
        characters: person.characters,
      };

      switch (person.role_type) {
        case "actor":
          cast.push(personInfo);
          break;
        case "director":
          directors.push(personInfo);
          break;
        case "writer":
          writers.push(personInfo);
          break;
        case "producer":
          producers.push(personInfo);
          break;
      }
    });

    // Get user ratings for this title
    const [ratings] = await connection.execute(
      `
      SELECT u.username, ur.rating_value, ur.review_text, ur.rated_at
      FROM user_rating ur
      JOIN app_user u ON u.user_id = ur.user_id
      WHERE ur.title_id = ?
      ORDER BY ur.rated_at DESC
    `,
      [titleId]
    );

    connection.release();

    res.json({
      ...title,
      cast: cast,
      directors: directors,
      writers: writers,
      producers: producers,
      user_ratings: ratings,
    });
  } catch (error) {
    console.error("Error fetching title details:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q3: Top Genres by Average Rating
// Demonstrates: aggregation, GROUP BY, HAVING
app.get("/api/genres/top", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT
        g.genre_name,
        AVG(ur.rating_value) AS avg_rating,
        COUNT(*) AS num_ratings
      FROM genre_lookup g
      JOIN title_genre tg ON tg.genre_id = g.genre_id
      JOIN user_rating ur ON ur.title_id = tg.title_id
      GROUP BY g.genre_name
      HAVING COUNT(*) >= 2
      ORDER BY avg_rating DESC
      LIMIT 20
    `);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching top genres:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q4: Users who rated a title above threshold
// Demonstrates: join, filtering, ORDER BY
app.get("/api/titles/:titleId/high-raters", async (req, res) => {
  try {
    const { titleId } = req.params;
    const { minRating = 8 } = req.query;

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `
      SELECT u.user_id, u.username, ur.rating_value, ur.rated_at
      FROM app_user u
      JOIN user_rating ur ON ur.user_id = u.user_id
      WHERE ur.title_id = ? AND ur.rating_value >= ?
      ORDER BY ur.rating_value DESC, ur.rated_at DESC
    `,
      [titleId, minRating]
    );
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error("Error fetching high raters:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q5: Titles with or without ratings
// Demonstrates: LEFT OUTER JOIN, aggregation
app.get("/api/titles/with-ratings", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT
        t.title_id,
        t.primary_title,
        t.start_year,
        COALESCE(t.avg_rating, 0) AS avg_rating,
        COALESCE(t.num_votes, 0) AS num_votes
      FROM title t
      LEFT JOIN user_rating ur ON ur.title_id = t.title_id
      GROUP BY
        t.title_id,
        t.primary_title,
        t.start_year,
        t.avg_rating,
        t.num_votes
      ORDER BY t.num_votes DESC
      LIMIT 50
    `);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching titles with ratings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q6: Titles better than global average
// Demonstrates: scalar subquery, filtering, ORDER BY
app.get("/api/titles/above-average", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT t.title_id, t.imdb_tconst, t.primary_title, t.start_year, 
             COALESCE(t.avg_rating, 0) AS avg_rating, t.num_votes
      FROM title t
      WHERE t.avg_rating IS NOT NULL
        AND t.avg_rating >= (
          SELECT AVG(avg_rating)
          FROM title
          WHERE avg_rating IS NOT NULL
        )
      ORDER BY t.avg_rating DESC, t.num_votes DESC
      LIMIT 50
    `);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching above-average titles:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q7: User Rating History with Window Function (ROW_NUMBER)
// Demonstrates: view usage, window function, PARTITION BY
app.get("/api/users/:userId/rating-history", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `
      SELECT
        v.user_id,
        v.username,
        v.title_id,
        v.primary_title,
        v.rating_value,
        v.review_text,
        v.rated_at,
        ROW_NUMBER() OVER (
          PARTITION BY v.user_id
          ORDER BY v.rated_at DESC
        ) AS rating_rank_recent
      FROM v_user_rating_history v
      WHERE v.user_id = ?
      ORDER BY v.rated_at DESC
    `,
      [userId]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching rating history:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q8: Rating Percentile within each title
// Demonstrates: window function (PERCENT_RANK)
app.get("/api/titles/:titleId/rating-percentiles", async (req, res) => {
  try {
    const { titleId } = req.params;
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `
      SELECT
        ur.user_rating_id,
        ur.user_id,
        ur.title_id,
        ur.rating_value,
        PERCENT_RANK() OVER (
          PARTITION BY ur.title_id
          ORDER BY ur.rating_value
        ) AS rating_percentile
      FROM user_rating ur
      WHERE ur.title_id = ?
    `,
      [titleId]
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching rating percentiles:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q9: Get Recommendations for User (Stored Procedure)
// Demonstrates: stored procedure, business logic
app.get("/api/users/:userId/recommendations", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "CALL get_recommendations_for_user(?, ?)",
      [userId, parseInt(limit)]
    );
    connection.release();

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: error.message });
  }
});

// Q10: Titles where the same person is both actor and director
// Demonstrates: self-joins on junction table, complex join
app.get("/api/titles/multi-role-people", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT DISTINCT
        t.title_id,
        t.primary_title,
        p.person_id,
        p.primary_name,
        GROUP_CONCAT(DISTINCT tpr.role_type ORDER BY tpr.role_type SEPARATOR ', ') AS roles
      FROM title t
      JOIN title_person_role tpr ON tpr.title_id = t.title_id
      JOIN person p ON p.person_id = tpr.person_id
      WHERE p.person_id IN (
        SELECT person_id FROM title_person_role
        GROUP BY person_id
        HAVING COUNT(DISTINCT role_type) > 1
      )
      GROUP BY t.title_id, t.primary_title, p.person_id, p.primary_name
      ORDER BY t.primary_title
      LIMIT 50
    `);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching multi-role people:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rate a Title
app.post("/api/users/:userId/rate", async (req, res) => {
  try {
    const { userId } = req.params;
    const { titleId, ratingValue, reviewText } = req.body;

    if (!titleId || !ratingValue || ratingValue < 1 || ratingValue > 10) {
      return res.status(400).json({ error: "Invalid rating value (1-10)" });
    }

    const connection = await pool.getConnection();

    try {
      // Try to insert or update
      await connection.execute(
        `
        INSERT INTO user_rating (user_id, title_id, rating_value, review_text)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          rating_value = VALUES(rating_value),
          review_text = VALUES(review_text),
          rated_at = CURRENT_TIMESTAMP
      `,
        [userId, titleId, ratingValue, reviewText || null]
      );

      connection.release();
      res.json({ success: true, message: "Rating saved successfully" });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error rating title:", error);
    res.status(500).json({ error: error.message });
  }
});

// TRANSACTION EXAMPLE: Multi-step rating with validation and rollback
// Demonstrates: multi-step transaction with rollback handling
app.post("/api/users/:userId/rate-with-validation", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { userId } = req.params;
    const { titleId, ratingValue, reviewText } = req.body;

    // Validate input
    if (!titleId || !ratingValue || ratingValue < 1 || ratingValue > 10) {
      return res.status(400).json({ error: "Invalid rating value (1-10)" });
    }

    // Start transaction
    await connection.beginTransaction();

    // Step 1: Check if user exists
    const [userCheck] = await connection.execute(
      "SELECT user_id FROM app_user WHERE user_id = ?",
      [userId]
    );

    if (userCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    // Step 2: Check if title exists
    const [titleCheck] = await connection.execute(
      "SELECT title_id FROM title WHERE title_id = ?",
      [titleId]
    );

    if (titleCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Title not found" });
    }

    // Step 3: Insert or update rating
    await connection.execute(
      `
      INSERT INTO user_rating (user_id, title_id, rating_value, review_text)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rating_value = VALUES(rating_value),
        review_text = VALUES(review_text),
        rated_at = CURRENT_TIMESTAMP
    `,
      [userId, titleId, ratingValue, reviewText || null]
    );

    // Step 4: Verify the rating was recorded correctly
    const [ratingCheck] = await connection.execute(
      "SELECT rating_value FROM user_rating WHERE user_id = ? AND title_id = ?",
      [userId, titleId]
    );

    if (
      ratingCheck.length === 0 ||
      ratingCheck[0].rating_value !== ratingValue
    ) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({ error: "Rating verification failed" });
    }

    // Commit transaction
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: "Rating saved successfully with validation",
      rating: ratingCheck[0],
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }
    connection.release();
    console.error("Error in transaction:", error);
    res.status(500).json({ error: error.message });
  }
});

// CONCURRENCY SCENARIO: Simulated concurrent rating updates
// Demonstrates: isolation levels and row locking
app.get("/api/concurrency-demo/:titleId", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { titleId } = req.params;

    // Use REPEATABLE READ isolation level for this scenario
    await connection.execute(
      "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ"
    );

    // Start transaction
    await connection.beginTransaction();

    // Read current rating with lock (FOR UPDATE)
    const [currentRating] = await connection.execute(
      `SELECT COALESCE(AVG(rating_value), 0) AS avg_rating, 
              COUNT(*) AS num_ratings 
       FROM user_rating 
       WHERE title_id = ? 
       FOR UPDATE`,
      [titleId]
    );

    // Simulate some processing time (in real scenario, another session might try to update)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get updated stats
    const [finalStats] = await connection.execute(
      `SELECT t.avg_rating, t.num_votes 
       FROM title 
       WHERE title_id = ?`,
      [titleId]
    );

    await connection.commit();
    connection.release();

    res.json({
      message: "Concurrency demo completed with REPEATABLE READ isolation",
      current_avg: currentRating[0]?.avg_rating || 0,
      num_ratings: currentRating[0]?.num_ratings || 0,
      title_stats: finalStats[0] || {},
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }
    connection.release();
    console.error("Concurrency demo error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get All Users
app.get("/api/users", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT user_id, username, email, is_admin FROM app_user"
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get All Genres
app.get("/api/genres", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT genre_id, genre_name FROM genre_lookup ORDER BY genre_name"
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching genres:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get All Titles (for selects)
app.get("/api/titles", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT title_id, primary_title, start_year FROM title ORDER BY primary_title"
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Error fetching titles:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "IMDb API is running" });
});

// API Documentation endpoint
app.get("/api/docs", (req, res) => {
  const docs = {
    title: "IMDb Recommendations App API",
    version: "1.0.0",
    baseUrl: "http://localhost:3000/api",
    endpoints: {
      search: {
        method: "GET",
        path: "/titles/search",
        params: ["keyword", "year_from", "year_to", "type", "genre"],
        description: "Search and browse titles with filters",
      },
      titleDetail: {
        method: "GET",
        path: "/titles/:titleId",
        description:
          "Get detailed info about a title with cast/crew and ratings",
      },
      topGenres: {
        method: "GET",
        path: "/genres/top",
        description: "Get top genres by average user rating",
      },
      highRaters: {
        method: "GET",
        path: "/titles/:titleId/high-raters",
        params: ["minRating"],
        description: "Get users who rated a title highly",
      },
      ratingHistory: {
        method: "GET",
        path: "/users/:userId/rating-history",
        description: "Get user's rating history with window function ranking",
      },
      recommendations: {
        method: "GET",
        path: "/users/:userId/recommendations",
        params: ["limit"],
        description: "Get personalized recommendations via stored procedure",
      },
      submitRating: {
        method: "POST",
        path: "/users/:userId/rate",
        body: ["titleId", "ratingValue", "reviewText"],
        description: "Submit a rating for a title",
      },
      transactionRating: {
        method: "POST",
        path: "/users/:userId/rate-with-validation",
        body: ["titleId", "ratingValue", "reviewText"],
        description:
          "Submit rating with transaction validation and rollback support",
      },
      concurrencyDemo: {
        method: "GET",
        path: "/concurrency-demo/:titleId",
        description: "Demonstrate concurrency handling with row locking",
      },
    },
  };
  res.json(docs);
});

// Serve index.html for all other routes (SPA)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ API documentation at http://localhost:${PORT}/api/docs`);
  console.log(`✓ Web UI at http://localhost:${PORT}`);
});

module.exports = app;
