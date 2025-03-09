import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  // for storing our form data when signing up
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  // for storing input changes to form data
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      const data = await response.json();
      console.log(`response is:`, data);
      if (response.ok) {
        console.log(`Success! Returned token is: ${data.access_token}`);
      }
      else {
        console.log(`Error: ${data.error}`);
      }
    }
    catch (error) {
      console.log(`Sign up request failed: ${error.message}`)
    }
  }

  return (
    <div className="App">
      <h1>Carpool Coordinator Sign Up</h1>
      <form onSubmit={handleSubmit}>
        <input type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} required>
        </input>
        <input type="text" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required>
        </input>
        <input type="text" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required>
        </input>
        <button type="submit">
          Sign Up
        </button>
      </form>
    </div >
  )
}

export default App
