import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

function UserPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      const accessToken = Cookies.get('access_token');
      if (!accessToken) {
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        const response = await fetch('http://127.0.0.1:5000/api/users/me/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          setError('Failed to load user profile');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProfile(data.profile);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load user profile');
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleDeleteCar = async (licensePlate) => {
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
      navigate('/');
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete car with license plate ${licensePlate}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/cars/${licensePlate}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setError('Failed to delete car');
        return;
      }

      // Refresh the profile data
      const refreshResponse = await fetch('http://127.0.0.1:5000/api/users/me/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!refreshResponse.ok) {
        setError('Failed to refresh profile data');
        return;
      }

      const data = await refreshResponse.json();
      setProfile(data.profile);
    } catch (error) {
      console.error('Error deleting car:', error);
      setError('Failed to delete car');
    }
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Loading profile information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#2A9D8F]">
              User Profile
            </h1>
            <button
              onClick={handleGoHome}
              className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
            >
              Back to Home
            </button>
          </div>

          {error && (
            <div className="bg-red-100 text-red-800 p-4 mb-4 rounded-lg">
              {error}
            </div>
          )}

          {profile && (
            <div className="space-y-8">
              {/* User Information Section */}
              <div className="bg-[#E9F5F5] p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-[#2A9D8F]">Personal Information</h2>
                  <button
                    onClick={() => navigate('/quiz?id=user_info_quiz')}
                    className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
                  >
                    Update User Info
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.user_info ? (
                    <>
                      <div>
                        <p className="text-gray-600 font-medium">Username:</p>
                        <p>{profile.user_info.username || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Email:</p>
                        <p>{profile.user_info.email || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Full Name:</p>
                        <p>
                          {profile.user_info.given_name && profile.user_info.surname 
                            ? `${profile.user_info.given_name} ${profile.user_info.surname}`
                            : 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Birth Date:</p>
                        <p>{profile.user_info.birth_date || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Sex:</p>
                        <p>{profile.user_info.sex || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Home Address:</p>
                        <p className="break-words">{profile.user_info.home_address || 'Not provided'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="col-span-2 text-yellow-600">
                      Personal information not yet provided. Please update your user info.
                    </p>
                  )}
                </div>
              </div>

              {/* Driver Information Section */}
              <div className="bg-[#E9F5F5] p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-[#2A9D8F]">Driver Information</h2>
                  <button
                    onClick={() => navigate('/quiz?id=driver_info_quiz')}
                    className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
                  >
                    Update Driver Info
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.driver_info ? (
                    <>
                      <div>
                        <p className="text-gray-600 font-medium">Driver's License Number:</p>
                        <p>{profile.driver_info.dln || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">License Expiration:</p>
                        <p>{profile.driver_info.license_expiration || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Licensed State:</p>
                        <p>{profile.driver_info.licensed_state || 'Not provided'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="col-span-2 text-yellow-600">
                      Driver information not yet provided. Please update your driver info.
                    </p>
                  )}
                </div>
              </div>

              {/* Cars Information Section */}
              <div className="bg-[#E9F5F5] p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-[#2A9D8F]">Car Information</h2>
                  <button
                    onClick={() => navigate('/quiz?id=car_info_quiz')}
                    className="px-4 py-2 bg-[#2A9D8F] text-white rounded-lg hover:bg-[#238577]"
                  >
                    Add New Car
                  </button>
                </div>

                {profile.cars && profile.cars.length > 0 ? (
                  <div className="space-y-4">
                    {profile.cars.map((car) => (
                      <div key={car.license_plate} className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-medium">
                            {car.year} {car.make} {car.model}
                          </h3>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => navigate(`/quiz?id=car_info_quiz&plate=${car.license_plate}`)}
                              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                              Update
                            </button>
                            <button
                              onClick={() => handleDeleteCar(car.license_plate)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">License Plate:</p>
                            <p className="font-medium">{car.license_plate}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">State:</p>
                            <p className="font-medium">{car.registered_state}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Capacity:</p>
                            <p className="font-medium">{car.max_capacity} passengers</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-yellow-600">
                    No cars registered. Please add a car.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserPage; 