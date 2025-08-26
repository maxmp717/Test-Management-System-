const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://test-management-system.onrender.com"
    : "http://localhost:5000";

export default API_BASE_URL;
