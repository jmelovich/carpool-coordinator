import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

function HomePage({ onLogout }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/');
        return;
      }

      try {
        const response = await fetch('http://127.0.0.1:5000/api/users/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
       // console.log("Access Token: ", accessToken);
        if (!response.ok) {
          console.error('Failed to fetch user information');
          // delete cookie
          Cookies.remove('access_token');
          // redirect to login
          navigate('/');
          return;
        }

        const data = await response.json();
        setUsername(data.user.username);
      } catch (error) {
        console.error('Error fetching user info:', error);
        setError('Failed to load user information');
        // If there's an error with the token, redirect to login
        navigate('/');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#2A9D8F]">
              Welcome, {username || 'Loading...'}!
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-[#E9F5F5] p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-[#2A9D8F] mb-4">
              Carpool Management
            </h2>
            <p className="text-gray-600 mb-4">
              Create, view, and manage your carpools.
            </p>
            <button
              onClick={() => navigate('/carpool')}
              className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
            >
              Carpool
            </button>
          </div>

          <div className="bg-[#E9F5F5] p-6 rounded-lg mt-6">
            <h2 className="text-xl font-semibold text-[#2A9D8F] mb-4">
              Quiz Page Demo
            </h2>
            <p className="text-gray-600 mb-4">
              This button will be removed, and this page will be dynamically linked to when needed. But for now its here so you can access it easier.
              I made this to make quizzing the user easier. Now we can have a single generic quiz page, because when this page is loaded- a quiz ID is passed as a URL argument.
              The backend will then return the quiz data based on the ID, and the quiz will be displayed- this means that quizzes can be defined easily in JSON without having 
              to change the page or do any code. I've already included support for text input, dropdowns, checkboxes, multiple choice, and address inputs. 
              
              In practice, when the user goes to the 'create carpool' page for example, the site can redirect the user to the quiz page first and refer to the 'create_carpool' quiz via 
              an ID in the URL argument. When the backend support is implemented, and quiz results can be saved- I will make the page fully functional (redirecting back to correct page, autopopulate fields, etc...)
            </p>
            <button
              onClick={() => navigate('/quiz?id=sample_quiz')}
              className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
            >
              Try Sample Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage; 