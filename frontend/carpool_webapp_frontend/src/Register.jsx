import { useState } from 'react';
import './App.css';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [message, setMessage] = useState(null);
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (password) => {
    // min 8 characters, one letter, one number - order should not matter (widely used format)
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(password);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!validatePassword(formData.password)) {
      setPasswordError("Password must include at least 8 characters, with at least one letter and one number.");
      return;
    } else {
      setPasswordError('');
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

  return (
    <div className="mt-6 p-6 bg-[#B2C8BA] rounded-lg shadow-lg w-80">
      <h2 className="text-xl font-semibold mb-4">Sign Up</h2>

      {message && (
        <div className={`alert ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} p-4 mb-4`}>
          {message.text}
        </div>
      )}

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

        {passwordError && <p className="text-red-600">{passwordError}</p>}

        <button
          type="submit"
          className="w-full p-2 bg-[#228B22] text-white rounded-lg hover:bg-[#1c6e1c]"
        >
          Sign Up
        </button>
      </form>
    </div>
  );
}

export default Register;
