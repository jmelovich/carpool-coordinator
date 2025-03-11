import { useState } from 'react';
import './App.css';

function App() {
  // for storing our form data when signing up
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPasswordInstructions, setShowPasswordInstructions] = useState("");
  const [message, setMessage] = useState(null); // State for storing messages

  const validatePassword = password => {
    const regex = /^[a-zA-Z]+[0-9]+$/;
    return regex.test(password);
  }
  // for storing input changes to form data
  const handleChange = (e) => {
    const name = e.target.name;
    const value = e.target.value;
    setFormData({ ...formData, [name]: value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!validatePassword(formData.password)) {
      setShowPasswordInstructions("Password must include at least 1 alphabetical character followed up with at least 1 number");
      return;
    } else {
      setShowPasswordInstructions("");
    }

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
      setMessage({ type: "success", text: 'User registered successfully!' });
    } else {
      console.log('Error:', data.error);
      setMessage({ type: "error", text: data.error });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log('Logging in with:', formData.username, formData.password);
    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('Success! Returned token is:', data.access_token);
      console.log('User id is:', data.user.id);
      console.log('User is:', data.user.username);
      setMessage({ type: "success", text: 'Login successful!' });
    } else {
      console.log('Error:', data.error);
      setMessage({ type: "error", text: data.error });
    }
  };

  return (
    <div className="App">
      <h1 className="text-4xl font-bold text-[#2A9D8F] mb-6 font-sans">
        Welcome to Carpool Coordinator!
      </h1>

      <div className="space-x-4 mb-6">
        <button
          className="px-4 py-2 bg-[#228B22] text-white rounded-lg hover:bg-[#1c6e1c]"
          onClick={() => {
            setShowSignup(true);
            setShowLogin(false);
            setMessage(null);
          }}
        >
          Sign Up
        </button>
        <button
          className="px-4 py-2 bg-[#87CEEB] text-[#333333] rounded-lg hover:bg-[#6bb5d8]"
          onClick={() => {
            setShowLogin(true);
            setShowSignup(false);
            setMessage(null);
          }}
        >
          Log In
        </button>
      </div>

      {message && (
        <div className={`alert ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} p-4 mb-4`}>
          {message.text}
        </div>
      )}

      {showSignup && (
        <div className="mt-6 p-6 bg-[#B2C8BA] rounded-lg shadow-lg w-80">
          <h2 className="text-xl font-semibold mb-4">Sign Up</h2>
          <form onSubmit={handleSignup}>
            <label className="largeLabel" htmlFor="username">
              <input
                className="inputBox w-full p-2 mb-2 border rounded"
                type="text"
                name="username"
                id="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="email">
              <input
                className="inputBox w-full p-2 mb-2 border rounded"
                type="email"
                name="email"
                id="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="password">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="password"
                name="password"
                id="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>

            {showPasswordInstructions && <p style={{ color: "red" }}>{showPasswordInstructions}</p>}

            <button
              type="submit"
              className="w-full p-2 bg-[#228B22] text-white rounded-lg hover:bg-[#1c6e1c]"
            >
              Sign Up
            </button>
          </form>
        </div>
      )}

      {showLogin && (
        <div className="mt-6 p-6 bg-white shadow-lg rounded-lg border w-80">
          <h2 className="text-lg font-semibold mb-2">Log In</h2>
          <form onSubmit={handleLogin}>
            <label className="largeLabel" htmlFor="username">
              <input
                className="inputBox w-full p-2 mb-2 border rounded"
                type="text"
                name="username"
                id="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="password">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="password" 
                name="password"
                id="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </label>
            <button
              type="submit"
              className="w-full p-2 bg-[#87CEEB] text-[#333333] rounded-lg hover:bg-[#6bb5d8]"
            >
              Log In
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
