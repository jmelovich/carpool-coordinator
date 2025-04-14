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
        
        // Check for missing user info
        const missingInfoResponse = await fetch('http://127.0.0.1:5000/api/users/me/get-missing-info', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (missingInfoResponse.ok) {
          const missingInfoData = await missingInfoResponse.json();
          
          // Check if user_info is complete
          if (!missingInfoData.user_info.isComplete) {
            const quizId = missingInfoData.user_info.quiz_id;
            navigate(`/quiz?id=${quizId}`);
            return;
          }
        } else {
          console.error('Failed to fetch missing user info');
        }
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
            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/profile')}
                className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
              >
                View Profile
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Logout
              </button>
            </div>
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
              This directs to a test quiz that shows every question type. Use this for ease of accessing the quiz page, and working with styling.
            </p>
            <button
              onClick={() => navigate('/quiz?id=test_quiz')}
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