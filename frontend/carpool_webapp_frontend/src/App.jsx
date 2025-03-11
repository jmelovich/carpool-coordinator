import { useState } from 'react'
import './App.css'

function App() {
  // for storing our form data when signing up
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  // for storing input changes to form data
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    const data = await response.json();
    if (response.ok) {
      console.log('Success! Returned token is:', data.access_token);
    } else {
      console.log('Error:', data.error);
    }
  };

  const handleLogin = async (e) => {
    // replace this stuff with backend things later
    e.preventDefault();
    console.log('Logging in with:', formData.username, formData.password);
  };

  return (
    <div className="App">
      <h1 className="text-4xl font-bold mb-6 font-sans primary-text">
      Welcome to Carpool Coordinator!
      </h1>
      <div className="space-x-4 mb-6">
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowSignup(true);
            setShowLogin(false);
          }}
        >
          Sign Up
        </button>
        <button
          className="btn btn-accent"
          onClick={() => {
            setShowLogin(true);
            setShowSignup(false);
          }}
        >
          Log In
        </button>
      </div>

      {showSignup && (
        <div className="form-container bg-secondary">
          <h2 className="text-xl font-semibold mb-4">Sign Up</h2>
          <form onSubmit={handleSignup}>
            <input
              className="inputBox"
              type="text"
              name="username"
              id="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
            <input
              className="inputBox"
              type="email"
              name="email"
              id="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              className="inputBox"
              type="password"
              name="password"
              id="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit" className="btn btn-primary w-full">
              Sign Up
            </button>
          </form>
        </div>
      )}

      {showLogin && (
        <div className="form-container bg-white">
          <h2 className="text-lg font-semibold mb-2">Log In</h2>
          <form onSubmit={handleLogin}>
            <input
              className="inputBox"
              type="text"
              name="username"
              id="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
            <input
              className="inputBox"
              type="password"
              name="password"
              id="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit" className="btn btn-accent w-full">
              Log In
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
