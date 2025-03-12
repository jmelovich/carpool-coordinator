import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
    });
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            const response = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to register");
            }

            localStorage.setItem("access_token", data.access_token);
            alert("Registration successful! Redirecting to login...");
            navigate("/login");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-4xl font-bold text-[#2A9D8F] mb-6 font-sans">
                Sign Up for Carpool Coordinator
            </h1>

            <div className="mt-6 p-6 bg-[#B2C8BA] rounded-lg shadow-lg w-80">
                <h2 className="text-xl font-semibold mb-4">Create an Account</h2>
                {error && <p className="text-red-500">{error}</p>}

                <form onSubmit={handleSubmit}>
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

                    <button
                        type="submit"
                        className="w-full p-2 bg-[#228B22] text-white rounded-lg hover:bg-[#1c6e1c]"
                    >
                        Sign Up
                    </button>
                </form>

                <p className="mt-4 text-sm">
                    Already have an account?{" "}
                    <a href="/login" className="text-[#2A9D8F] underline">
                        Log in here
                    </a>
                </p>
            </div>
        </div>
    );
};

export default Register;