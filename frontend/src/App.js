import React, { useState, useEffect } from 'react';
import './App.css';

// API service using fetch
const API_BASE_URL = 'http://localhost:5000/api';

const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
};

// Auth service
const authService = {
  login: async (email, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  
  register: async (email, password, name) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
  },
  
  getToken: () => localStorage.getItem('token'),
  
  getAdmin: () => {
    const admin = localStorage.getItem('admin');
    return admin ? JSON.parse(admin) : null;
  },
  
  setAuth: (token, admin) => {
    localStorage.setItem('token', token);
    localStorage.setItem('admin', JSON.stringify(admin));
  }
};

// Test service
const testService = {
  getAll: async () => {
    const response = await apiRequest('/tests');
    return response.tests;
  },
  
  create: async (title, description) => {
    return apiRequest('/tests', {
      method: 'POST',
      body: JSON.stringify({ title, description })
    });
  },
  
  addQuestion: async (testId, questionData) => {
    return apiRequest(`/tests/${testId}/questions`, {
      method: 'POST',
      body: JSON.stringify(questionData)
    });
  },
  
  deleteQuestion: async (testId, questionId) => {
    return apiRequest(`/tests/${testId}/questions/${questionId}`, {
      method: 'DELETE'
    });
  },
  
  uploadCSV: async (testId, file) => {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/tests/${testId}/upload-csv`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  },
  
  delete: async (testId) => {
    return apiRequest(`/tests/${testId}`, {
      method: 'DELETE'
    });
  }
};

// Login Component
const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isRegistering) {
        result = await authService.register(formData.email, formData.password, name);
      } else {
        result = await authService.login(formData.email, formData.password);
      }

      authService.setAuth(result.token, result.admin);
      onLogin(result.admin);
    } catch (error) {
      setError(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">
            Test Management System
          </h1>
          <p className="login-subtitle">
            {isRegistering ? 'Create Admin Account' : 'Admin Login'}
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && (
            <div className="form-group">
              <label className="form-label">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`login-button ${loading ? 'loading' : ''}`}
          >
            {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>

        <div className="login-toggle">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="toggle-button"
          >
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Create Test Modal
const CreateTestModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({ title: '', description: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ title: '', description: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Create New Test</h2>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">
              Test Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="form-textarea"
              rows="3"
            />
          </div>
          
          <div className="modal-buttons">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Create Test
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Question Modal
const AddQuestionModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <h2 className="modal-title">Add Question</h2>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">
              Question Text *
            </label>
            <textarea
              value={formData.questionText}
              onChange={(e) => setFormData({...formData, questionText: e.target.value})}
              className="form-textarea"
              rows="3"
              required
            />
          </div>
          
          <div className="options-grid">
            {['A', 'B', 'C', 'D'].map(option => (
              <div key={option} className="form-group">
                <label className="form-label">
                  Option {option} *
                </label>
                <input
                  type="text"
                  value={formData[`option${option}`]}
                  onChange={(e) => setFormData({...formData, [`option${option}`]: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
            ))}
          </div>
          
          <div className="form-group">
            <label className="form-label">
              Correct Answer *
            </label>
            <select
              value={formData.correctAnswer}
              onChange={(e) => setFormData({...formData, correctAnswer: e.target.value})}
              className="form-select"
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          
          <div className="modal-buttons">
            <button
              type="submit"
              className="btn btn-success"
            >
              Add Question
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// CSV Upload Modal
const CSVUploadModal = ({ isOpen, onClose, onUpload, testId }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    
    setUploading(true);
    try {
      await onUpload(testId, file);
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Upload Questions CSV</h2>
        
        <div className="csv-format-info">
          <h3 className="info-title">CSV Format:</h3>
          <p className="info-text">
            questionText,option1,option2,option3,option4,correctAnswer
          </p>
          <p className="info-example">
            Example: "What is 2+2?,1,2,3,4,4"
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="form-file"
              required
            />
          </div>
          
          <div className="modal-buttons">
            <button
              type="submit"
              disabled={!file || uploading}
              className={`btn btn-primary ${(!file || uploading) ? 'disabled' : ''}`}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Test Item Component
const TestItem = ({ test, onAddQuestion, onUploadCSV, onDeleteQuestion, onDeleteTest }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="test-item">
      <div 
        className="test-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="test-info">
          <h3 className="test-title">{test.title}</h3>
          {test.description && (
            <p className="test-description">{test.description}</p>
          )}
          <p className="test-meta">
            {test.questions.length} questions
          </p>
        </div>
        <div className="test-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddQuestion(test._id);
            }}
            className="btn btn-success small"
          >
            Add Question
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUploadCSV(test._id);
            }}
            className="btn btn-primary small"
          >
            Upload CSV
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this test?')) {
                onDeleteTest(test._id);
              }
            }}
            className="btn btn-danger small"
          >
            Delete
          </button>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="test-questions">
          <div className="questions-container">
            <h4 className="questions-title">Questions:</h4>
            {test.questions.length === 0 ? (
              <p className="no-questions">No questions added yet.</p>
            ) : (
              <div className="questions-list">
                {test.questions.map((question, index) => (
                  <div key={question._id} className="question-item">
                    <div className="question-content">
                      <div className="question-text-container">
                        <p className="question-text">
                          {index + 1}. {question.questionText}
                        </p>
                        <div className="options-container">
                          {Object.entries(question.options).map(([key, value]) => (
                            <div
                              key={key}
                              className={`option ${
                                question.correctAnswer === key 
                                  ? 'correct' 
                                  : ''
                              }`}
                            >
                              {key}. {value}
                            </div>
                          ))}
                        </div>
                        <p className="correct-answer">
                          Correct Answer: {question.correctAnswer}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this question?')) {
                            onDeleteQuestion(test._id, question._id);
                          }
                        }}
                        className="btn btn-danger small"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Dashboard Component
const Dashboard = ({ admin, onLogout }) => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState(null);

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      setLoading(true);
      const testsData = await testService.getAll();
      setTests(testsData);
    } catch (error) {
      setError('Failed to load tests: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (message, type = 'success') => {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 5000);
  };

  const handleCreateTest = async (testData) => {
    try {
      await testService.create(testData.title, testData.description);
      setShowCreateTest(false);
      loadTests();
      showMessage('Test created successfully!');
    } catch (error) {
      showMessage('Failed to create test: ' + error.message, 'error');
    }
  };

  const handleAddQuestion = async (questionData) => {
    try {
      await testService.addQuestion(selectedTestId, questionData);
      setShowAddQuestion(false);
      setSelectedTestId(null);
      loadTests();
      showMessage('Question added successfully!');
    } catch (error) {
      showMessage('Failed to add question: ' + error.message, 'error');
    }
  };

  const handleDeleteQuestion = async (testId, questionId) => {
    try {
      await testService.deleteQuestion(testId, questionId);
      loadTests();
      showMessage('Question deleted successfully!');
    } catch (error) {
      showMessage('Failed to delete question: ' + error.message, 'error');
    }
  };

  const handleDeleteTest = async (testId) => {
    try {
      await testService.delete(testId);
      loadTests();
      showMessage('Test deleted successfully!');
    } catch (error) {
      showMessage('Failed to delete test: ' + error.message, 'error');
    }
  };

  const handleCSVUpload = async (testId, file) => {
    try {
      const result = await testService.uploadCSV(testId, file);
      setShowCSVUpload(false);
      setSelectedTestId(null);
      loadTests();
      showMessage(result.message);
    } catch (error) {
      showMessage('Failed to upload CSV: ' + error.message, 'error');
    }
  };

  const openAddQuestion = (testId) => {
    setSelectedTestId(testId);
    setShowAddQuestion(true);
  };

  const openCSVUpload = (testId) => {
    setSelectedTestId(testId);
    setShowCSVUpload(true);
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-info">
            <h1 className="dashboard-title">
              Test Management System
            </h1>
            <p className="dashboard-subtitle">Welcome back, {admin.name}</p>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setShowCreateTest(true)}
              className="btn btn-primary"
            >
              Create Test
            </button>
            <button
              onClick={onLogout}
              className="btn btn-secondary"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        
        {/* Messages */}
        {success && (
          <div className="message success">
            {success}
          </div>
        )}
        
        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {/* Tests List */}
        <div className="tests-section">
          <div className="section-header">
            <h2 className="section-title">Your Tests</h2>
            <p className="section-subtitle">Manage your tests and questions</p>
          </div>
          
          <div className="section-content">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading tests...</p>
              </div>
            ) : tests.length === 0 ? (
              <div className="empty-state">
                <p className="empty-message">No tests created yet.</p>
                <button
                  onClick={() => setShowCreateTest(true)}
                  className="btn btn-primary"
                >
                  Create Your First Test
                </button>
              </div>
            ) : (
              <div className="tests-grid">
                {tests.map(test => (
                  <TestItem
                    key={test._id}
                    test={test}
                    onAddQuestion={openAddQuestion}
                    onUploadCSV={openCSVUpload}
                    onDeleteQuestion={handleDeleteQuestion}
                    onDeleteTest={handleDeleteTest}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateTestModal
        isOpen={showCreateTest}
        onClose={() => setShowCreateTest(false)}
        onSubmit={handleCreateTest}
      />
      
      <AddQuestionModal
        isOpen={showAddQuestion}
        onClose={() => {
          setShowAddQuestion(false);
          setSelectedTestId(null);
        }}
        onSubmit={handleAddQuestion}
      />
      
      <CSVUploadModal
        isOpen={showCSVUpload}
        onClose={() => {
          setShowCSVUpload(false);
          setSelectedTestId(null);
        }}
        onUpload={handleCSVUpload}
        testId={selectedTestId}
      />
    </div>
  );
};

// Main App Component
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = authService.getToken();
    const savedAdmin = authService.getAdmin();
    
    if (token && savedAdmin) {
      setIsAuthenticated(true);
      setAdmin(savedAdmin);
    }
    
    setLoading(false);
  }, []);

  const handleLogin = (adminData) => {
    setIsAuthenticated(true);
    setAdmin(adminData);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setAdmin(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-content">
          <div className="loading-spinner large"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <Dashboard admin={admin} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;