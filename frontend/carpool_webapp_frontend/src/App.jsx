import { useState } from 'react'
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
      <div className="Login-border">
        <form onSubmit={handleSubmit}>
          <label className="largeLabel" htmlFor="username" >
            <input className="inputBox" type="text" name="username" id="username" placeholder="Username" value={formData.username} onChange={handleChange} required>
            </input> 
          </label>
          <label className="largeLabel" htmlFor="email">
            <input className="inputBox" type="text" name="email" id="email" placeholder="Email" value={formData.email} onChange={handleChange} required>
            </input> 
          </label>
          <label className="largeLabel" htmlFor="password">
            <input className="inputBox" type="text" name="password" id="password" placeholder="Password" value={formData.password} onChange={handleChange} required>
            </input> 
          </label>
          <button type="submit">
            Sign Up
          </button>
        </form>
        </div>
    </div >
  )
}

export default App
