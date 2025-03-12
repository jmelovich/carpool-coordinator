import { useState } from 'react';
import './App.css';

function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const [message, setMessage] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    <div className="mt-6 p-6 bg-white shadow-lg rounded-lg border w-80">
      <h2 className="text-lg font-semibold mb-2">Log In</h2>

      {message && (
        <div className={`alert ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} p-4 mb-4`}>
          {message.text}
        </div>
      )}

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
  );
}

export default Login;
