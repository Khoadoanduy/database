// =====================================================
// IMDb Recommendations App - Frontend
// =====================================================
const API_BASE_URL = "http://localhost:3000/api";

let allGenres = [];
let allUsers = [];
let allTitles = [];

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 App initializing...");
  await loadInitialData();
  console.log("✓ App ready");

  // Close modal when clicking outside of it
  const modal = document.getElementById("titleModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeTitleModal();
      }
    });
  }
});

// =====================================================
// DATA LOADING
// =====================================================
async function loadInitialData() {
  try {
    // Load genres
    const genresRes = await fetch(`${API_BASE_URL}/genres`);
    allGenres = await genresRes.json();
    populateGenreSelects();

    // Load users
    const usersRes = await fetch(`${API_BASE_URL}/users`);
    allUsers = await usersRes.json();
    populateUserSelects();

    // Load all titles
    const titlesRes = await fetch(`${API_BASE_URL}/titles`);
    allTitles = await titlesRes.json();
    populateTitleSelects();
  } catch (error) {
    console.error("Error loading initial data:", error);
    showMessage(
      "Error loading data. Make sure the backend is running.",
      "error"
    );
  }
}

function populateGenreSelects() {
  const genreSelects = ["searchGenre", "recommendationGenre"];
  genreSelects.forEach((selectId) => {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '<option value="">All Genres</option>';
      allGenres.forEach((genre) => {
        const option = document.createElement("option");
        option.value = genre.genre_name;
        option.textContent = genre.genre_name;
        select.appendChild(option);
      });
    }
  });
}

function populateUserSelects() {
  const userSelects = ["recommendationUser", "ratingUser", "rateUser"];
  userSelects.forEach((selectId) => {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Select a user...</option>';
    allUsers.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.user_id;
      option.textContent = `${user.username} (${user.email})`;
      select.appendChild(option);
    });
  });
}

function populateTitleSelects() {
  const titleSelect = document.getElementById("rateTitle");
  titleSelect.innerHTML = '<option value="">Select title...</option>';
  allTitles.forEach((title) => {
    const option = document.createElement("option");
    option.value = title.title_id;
    option.textContent = `${title.primary_title} (${title.start_year})`;
    titleSelect.appendChild(option);
  });
}

// =====================================================
// SECTION NAVIGATION
// =====================================================
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });

  // Remove active state from buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Show selected section
  document.getElementById(sectionId).classList.add("active");

  // Set button active
  if (event && event.target) {
    event.target.classList.add("active");
  }

  // Auto-load data for specific sections
  if (sectionId === "top-genres") {
    loadTopGenres();
  }
}

// =====================================================
// RATING TABS NAVIGATION
// =====================================================
function showRatingTab(tabId) {
  // Hide all rating tabs
  document.querySelectorAll(".rating-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Remove active state from tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Show selected tab
  document.getElementById(`${tabId}-tab`).classList.add("active");

  // Set button active
  if (event && event.target) {
    event.target.classList.add("active");
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function showMessage(message, type = "success") {
  const resultsDiv =
    document.getElementById("searchResults") ||
    document.getElementById("recommendationsResults") ||
    document.getElementById("topGenresResults") ||
    document.getElementById("userRatingsResults");
  if (resultsDiv) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `<span>${message}</span><span class="message-close" onclick="this.parentElement.remove()">✕</span>`;
    resultsDiv.insertBefore(messageDiv, resultsDiv.firstChild);
    setTimeout(() => {
      if (messageDiv.parentElement) messageDiv.remove();
    }, 5000);
  }
}

// =====================================================
// SEARCH & BROWSE (Q1)
// =====================================================
async function performSearch() {
  try {
    const keyword = document.getElementById("searchKeyword").value;
    const yearFrom = document.getElementById("searchYearFrom").value;
    const yearTo = document.getElementById("searchYearTo").value;
    const type = document.getElementById("searchType").value;
    const genre = document.getElementById("searchGenre").value;

    const params = new URLSearchParams();
    if (keyword) params.append("keyword", keyword);
    if (yearFrom) params.append("year_from", yearFrom);
    if (yearTo) params.append("year_to", yearTo);
    if (type) params.append("type", type);
    if (genre) params.append("genre", genre);

    const response = await fetch(`${API_BASE_URL}/titles/search?${params}`);
    const titles = await response.json();

    const resultsDiv = document.getElementById("searchResults");
    if (titles.length === 0) {
      resultsDiv.innerHTML =
        '<div class="empty-state"><h3>No results found</h3><p>Try adjusting your search filters</p></div>';
      return;
    }

    resultsDiv.innerHTML = titles
      .map(
        (title) => `
      <div class="result-card" onclick="viewTitleDetail(${title.title_id})">
        <h3>${escapeHtml(title.primary_title)}</h3>
        <div class="result-card-meta">
          <span class="meta-item">📅 ${title.start_year || "N/A"}</span>
          <span class="meta-item">📺 ${title.title_type}</span>
          <span class="meta-item">⏱️ ${
            title.runtime_minutes ? title.runtime_minutes + " min" : "N/A"
          }</span>
          <span class="rating-badge">⭐ ${title.avg_user_rating || 0}/10</span>
          <span class="meta-item">👥 ${title.user_rating_count} ratings</span>
        </div>
        <div>
          ${
            title.genres
              ? title.genres
                  .split(", ")
                  .map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`)
                  .join("")
              : "No genres"
          }
        </div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error searching:", error);
    showMessage("Error performing search", "error");
  }
}

// =====================================================
// TITLE DETAIL (Q2) - Enhanced Detailed Title Page
// =====================================================
async function viewTitleDetail(titleId) {
  try {
    const response = await fetch(`${API_BASE_URL}/titles/${titleId}`);
    const title = await response.json();
    const modal = document.getElementById("titleModal");
    const detailDiv = document.getElementById("titleDetail");

    // Format IMDb rating
    const imdbRating = title.imdb_avg_rating
      ? parseFloat(title.imdb_avg_rating).toFixed(1)
      : "N/A";
    const imdbVotes = title.num_votes
      ? parseInt(title.num_votes).toLocaleString()
      : "N/A";

    // Format user rating
    const userRating = title.avg_user_rating
      ? parseFloat(title.avg_user_rating).toFixed(1)
      : "N/A";
    const userRatingCount = title.user_rating_count || 0;

    // Format cast
    const castHTML =
      title.cast && title.cast.length > 0
        ? `
      <div class="detail-section">
        <h4 style="text-transform: capitalize; color: #667eea; margin-bottom: 15px; font-size: 18px;">
          🎭 Cast
        </h4>
        <div class="cast-list">
          ${title.cast
            .map(
              (p) => `
            <div class="cast-item">
              <strong>${escapeHtml(p.name)}</strong>
              ${p.characters ? `<em>as ${escapeHtml(p.characters)}</em>` : ""}
              ${
                p.birth_year
                  ? `<div class="person-info">${p.birth_year}${
                      p.death_year ? ` - ${p.death_year}` : ""
                    }</div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
        : "";

    // Format directors
    const directorsHTML =
      title.directors && title.directors.length > 0
        ? `
      <div class="detail-section">
        <h4 style="text-transform: capitalize; color: #667eea; margin-bottom: 15px; font-size: 18px;">
          🎬 Directors
        </h4>
        <div class="crew-list">
          ${title.directors
            .map(
              (p) => `
            <div class="crew-item">
              <strong>${escapeHtml(p.name)}</strong>
              ${
                p.birth_year
                  ? `<div class="person-info">${p.birth_year}${
                      p.death_year ? ` - ${p.death_year}` : ""
                    }</div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
        : "";

    // Format writers
    const writersHTML =
      title.writers && title.writers.length > 0
        ? `
      <div class="detail-section">
        <h4 style="text-transform: capitalize; color: #667eea; margin-bottom: 15px; font-size: 18px;">
          ✍️ Writers
        </h4>
        <div class="crew-list">
          ${title.writers
            .map(
              (p) => `
            <div class="crew-item">
              <strong>${escapeHtml(p.name)}</strong>
              ${
                p.birth_year
                  ? `<div class="person-info">${p.birth_year}${
                      p.death_year ? ` - ${p.death_year}` : ""
                    }</div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
        : "";

    // Format producers
    const producersHTML =
      title.producers && title.producers.length > 0
        ? `
      <div class="detail-section">
        <h4 style="text-transform: capitalize; color: #667eea; margin-bottom: 15px; font-size: 18px;">
          🎥 Producers
        </h4>
        <div class="crew-list">
          ${title.producers
            .map(
              (p) => `
            <div class="crew-item">
              <strong>${escapeHtml(p.name)}</strong>
              ${
                p.birth_year
                  ? `<div class="person-info">${p.birth_year}${
                      p.death_year ? ` - ${p.death_year}` : ""
                    }</div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
        : "";

    // Format user ratings
    const ratingsHTML =
      title.user_ratings && title.user_ratings.length > 0
        ? title.user_ratings
            .map(
              (rating) => `
          <div class="rating-item">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong>${escapeHtml(rating.username)}</strong>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="stars">${"⭐".repeat(rating.rating_value)}</span>
                <span style="color: #999; font-size: 12px;">${new Date(
                  rating.rated_at
                ).toLocaleDateString()}</span>
              </div>
            </div>
            ${
              rating.review_text
                ? `<div class="review-text">"${escapeHtml(
                    rating.review_text
                  )}"</div>`
                : ""
            }
          </div>
        `
            )
            .join("")
        : '<p style="color: #999; font-style: italic;">No user reviews yet. Be the first to rate!</p>';

    detailDiv.innerHTML = `
      <div class="title-detail">
        <div class="title-header">
          <h2>${escapeHtml(title.primary_title)}</h2>
          <div class="title-meta-info">
            <span class="meta-badge">${title.start_year || "N/A"}</span>
            <span class="meta-badge">${title.title_type || "N/A"}</span>
            ${
              title.runtime_minutes
                ? `<span class="meta-badge">${title.runtime_minutes} min</span>`
                : ""
            }
            ${title.is_adult ? '<span class="meta-badge adult">18+</span>' : ""}
          </div>
        </div>

        <div class="ratings-section">
          <div class="rating-card imdb-rating">
            <div class="rating-label">IMDb Rating</div>
            <div class="rating-value">${imdbRating}</div>
            <div class="rating-count">${imdbVotes} votes</div>
          </div>
          <div class="rating-card user-rating">
            <div class="rating-label">User Rating</div>
            <div class="rating-value">${userRating}</div>
            <div class="rating-count">${userRatingCount} ${
      userRatingCount === 1 ? "rating" : "ratings"
    }</div>
          </div>
        </div>

        <div class="detail-section">
          <h3>📋 Overview</h3>
          <div class="overview-content">
            <div class="overview-item">
              <strong>Genres:</strong>
              <div class="genre-list">
                ${
                  title.genres && title.genres !== "N/A"
                    ? title.genres
                        .split(", ")
                        .map(
                          (g) =>
                            `<span class="genre-tag">${escapeHtml(g)}</span>`
                        )
                        .join("")
                    : "<span>N/A</span>"
                }
              </div>
            </div>
            ${
              title.imdb_tconst
                ? `<div class="overview-item"><strong>IMDb ID:</strong> ${title.imdb_tconst}</div>`
                : ""
            }
          </div>
        </div>

        ${directorsHTML}
        ${writersHTML}
        ${producersHTML}
        ${castHTML}

        <div class="detail-section">
          <h3>⭐ User Reviews & Ratings</h3>
          <div class="ratings-container">
            ${ratingsHTML}
          </div>
        </div>
      </div>
    `;
    modal.classList.add("show");
  } catch (error) {
    console.error("Error fetching title detail:", error);
    showMessage("Error loading title details", "error");
  }
}

function closeTitleModal() {
  document.getElementById("titleModal").classList.remove("show");
}

// =====================================================
// TOP GENRES (Q3)
// =====================================================
async function loadTopGenres() {
  try {
    const response = await fetch(`${API_BASE_URL}/genres/top`);
    const genres = await response.json();
    console.log(genres);
    const resultsDiv = document.getElementById("topGenresResults");

    if (genres.length === 0) {
      resultsDiv.innerHTML =
        '<div class="empty-state"><h3>No genre data available</h3><p>Genres need at least 2 ratings</p></div>';
      return;
    }

    resultsDiv.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Genre</th>
            <th>Avg User Rating</th>
            <th>Number of Ratings</th>
          </tr>
        </thead>
        <tbody>
          ${genres
            .map(
              (g) => `
            <tr>
              <td><strong>${escapeHtml(g.genre_name)}</strong></td>
              <td>${g.avg_rating || 0}/10</td>
              <td>${g.num_ratings}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error("Error loading top genres:", error);
    showMessage("Error loading top genres", "error");
  }
}

// =====================================================
// RECOMMENDATIONS (Q9 - Stored Procedure)
// =====================================================
async function getRecommendations() {
  const userId = document.getElementById("recommendationUser").value;
  const selectedGenre = document.getElementById("recommendationGenre").value;

  if (!userId) {
    showMessage("Please select a user", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/users/${userId}/recommendations?limit=50`
    );
    const recommendations = await response.json();
    const resultsDiv = document.getElementById("recommendationsResults");

    // Filter by selected genre if one is chosen
    let filteredRecommendations = recommendations;
    if (selectedGenre) {
      filteredRecommendations = recommendations.filter((rec) => {
        if (!rec.genres || rec.genres === "N/A") return false;
        const genres = rec.genres.split(", ").map((g) => g.trim());
        return genres.includes(selectedGenre);
      });
    }

    if (filteredRecommendations.length === 0) {
      resultsDiv.innerHTML =
        '<div class="empty-state"><h3>No recommendations available</h3><p>' +
        (selectedGenre
          ? `No recommendations found for ${selectedGenre} genre. User needs to rate titles with 8+ stars first.`
          : "User needs to rate titles with 8+ stars first") +
        "</p></div>";
      return;
    }

    resultsDiv.innerHTML = filteredRecommendations
      .map(
        (rec) => `
      <div class="result-card" onclick="viewTitleDetail(${rec.title_id})">
        <h3>${escapeHtml(rec.primary_title)}</h3>
        <div class="result-card-meta">
          <span class="meta-item">📅 ${rec.start_year}</span>
          <span class="meta-item">💡 ${escapeHtml(rec.reason)}</span>
          <span class="rating-badge">⭐ ${rec.avg_rating || 0}/10</span>
        </div>
        <div>
          ${
            rec.genres
              ? rec.genres
                  .split(", ")
                  .map((g) => `<span class="genre-tag">${escapeHtml(g)}</span>`)
                  .join("")
              : "N/A"
          }
        </div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error getting recommendations:", error);
    showMessage("Error getting recommendations", "error");
  }
}

// =====================================================
// USER RATINGS (Q7 - Window Function)
// =====================================================
async function loadUserRatings() {
  const userId = document.getElementById("ratingUser").value;
  if (!userId) {
    showMessage("Please select a user", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/users/${userId}/rating-history`
    );
    const ratings = await response.json();
    const resultsDiv = document.getElementById("userRatingsResults");

    if (ratings.length === 0) {
      resultsDiv.innerHTML =
        '<div class="empty-state"><h3>No ratings yet</h3><p>This user hasn\'t rated any titles</p></div>';
      return;
    }

    resultsDiv.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Rating</th>
            <th>Review</th>
            <th>Rated At</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          ${ratings
            .map(
              (r) => `
            <tr onclick="viewTitleDetail(${
              r.title_id
            })" style="cursor: pointer;">
              <td><strong>${escapeHtml(r.primary_title)}</strong></td>
              <td>${"⭐".repeat(r.rating_value)}</td>
              <td>${
                r.review_text
                  ? `"${escapeHtml(r.review_text.substring(0, 50))}..."`
                  : "No review"
              }</td>
              <td>${new Date(r.rated_at).toLocaleDateString()}</td>
              <td>#${r.rating_rank_recent}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error("Error fetching rating history:", error);
    showMessage("Error loading rating history", "error");
  }
}

// =====================================================
// SUBMIT RATING
// =====================================================
async function submitRating() {
  const userId = document.getElementById("rateUser").value;
  const titleId = document.getElementById("rateTitle").value;
  const ratingValue = parseInt(document.getElementById("rateValue").value);
  const reviewText = document.getElementById("rateReview").value;

  if (!userId || !titleId || !ratingValue) {
    showMessage("Please fill in all required fields", "error");
    return;
  }

  if (ratingValue < 1 || ratingValue > 10) {
    showMessage("Rating must be between 1 and 10", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titleId,
        ratingValue,
        reviewText: reviewText || null,
      }),
    });

    if (response.ok) {
      showMessage("Rating submitted successfully! ✓", "success");
      document.getElementById("rateValue").value = "";
      document.getElementById("rateReview").value = "";
    } else {
      showMessage("Error submitting rating", "error");
    }
  } catch (error) {
    console.error("Error submitting rating:", error);
    showMessage("Error submitting rating", "error");
  }
}

// =====================================================
// SECURITY: XSS Prevention
// =====================================================
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
