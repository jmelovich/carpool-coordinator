import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import CarpoolMap from './CarpoolMap';

function CreateCarpool() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      navigate('/');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#2A9D8F]">
              Create a New Carpool
            </h1>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/carpool')}
                className="px-4 py-2 bg-[#264653] text-white rounded-lg hover:bg-[#1a323c]"
              >
                Back to Carpools
              </button>
              <button
                onClick={() => navigate('/home')}
                className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
              >
                Back to Home
              </button>
            </div>
          </div>
          <CarpoolMap />
        </div>
      </div>
    </div>
  );
}

export default CreateCarpool; 