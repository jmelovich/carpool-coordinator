import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './Login';
import Register from './Register';
import HomePage from './HomePage';
import CreateCarpool from './CreateCarpool';
import Cookies from 'js-cookie';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated by looking for the access token
    const accessToken = Cookies.get('access_token');
    setIsAuthenticated(!!accessToken);
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to="/home" replace />
              ) : (
                <div>
                  <h1 className="text-4xl font-bold text-[#2A9D8F] mb-6 font-sans">
                    Welcome to Carpool Coordinator!
                  </h1>
                  <div className="space-x-4 mb-6">
                    <button
                      className="px-4 py-2 bg-[#228B22] text-white rounded-lg hover:bg-[#1c6e1c]"
                      onClick={() => window.location.href = '/register'}
                    >
                      Sign Up
                    </button>
                    <button
                      className="px-4 py-2 bg-[#87CEEB] text-[#333333] rounded-lg hover:bg-[#6bb5d8]"
                      onClick={() => window.location.href = '/login'}
                    >
                      Log In
                    </button>
                  </div>
                </div>
              )
            }
          />
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/home" replace />
              ) : (
                <Login setIsAuthenticated={setIsAuthenticated} />
              )
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to="/home" replace />
              ) : (
                <Register setIsAuthenticated={setIsAuthenticated} />
              )
            }
          />
          <Route
            path="/home"
            element={
              isAuthenticated ? (
                <HomePage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/create-carpool"
            element={
              isAuthenticated ? (
                <CreateCarpool />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;