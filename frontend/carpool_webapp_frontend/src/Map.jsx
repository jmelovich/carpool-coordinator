import { useState } from 'react';
import './App.css';

function Map() {

    /*  
    need to implement
        - feature that allows adding the car's make, license plate, and color
            *- should appear through option of making the user a driver
            *- most likely another component/asset like in a "CarFeatures.jsx"
                *- maybe you can use drop downs for a list of the car's make and color, and then text input for license plate 
                    *- make sure license plate has a limited amount of characters 
                    *- (check US license plate character limit, probably 8 or something)
        - map using google maps API
            *- make sure you can specify location and destination using drop map mark
            *- account for if the location specified isn't a real location or there isn't a result found
    */

    const [carRideData, setCarRideData] = useState({
        origin: '',
        destination: '',
    })
    const [carpoolData, setCarpoolData] = useState({
        occupation_preference: '',
        personality_preference: '',
        occupation_current: '',
        personality_current: '',
        is_passenger: true
    });
    const [message, setMessage] = useState(null);

    const handleChangeCarRideData = (e) => {
        setCarRideData({ ...carRideData, [e.target.name]: e.target.value });
    };

    const handleChangeCarpoolData = (e) => {
        setCarpoolData({ ...carpoolData, [e.target.name]: e.target.value });
    };

    // google maps API should be here
    const handleMakeCarpool = async (e) => {
        e.preventDefault();
        
        const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(carRideData),
            });
        
            const data = await response.json();
            if (response.ok) {
            console.log('Success! Returned token is:', data.access_token);
            console.log('User id is:', data.user.id);
            console.log('User is:', data.user.username);
            setMessage({ type: "success", text: 'Successfully made car ride!' });
            } else {
            console.log('Error:', data.error);
            setMessage({ type: "error", text: data.error });
        }
    }

    return (
        <div className="mt-6 p-6 bg-white shadow-lg rounded-lg border w-80">
          <h2 className="text-lg font-semibold mb-2">Where are you going?</h2>
    
          {message && (
            <div className={`alert ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} p-4 mb-4`}>
              {message.text}
            </div>
          )}
    
          <form onSubmit={handleMakeCarpool}>
            <label className="largeLabel" htmlFor="origin">
              <input
                className="inputBox w-full p-2 mb-2 border rounded"
                type="text"
                name="origin"
                id="origin"
                placeholder="Origin"
                value={carRideData.origin}
                onChange={handleChangeCarRideData}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="destination">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="text"
                name="destination"
                id="destination"
                placeholder="Destination"
                value={carRideData.destination}
                onChange={handleChangeCarRideData}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="occupation_preference">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="text"
                name="occupation_preference"
                id="occupation_preference"
                placeholder="Occupation preference"
                value={carpoolData.occupation_preference}
                onChange={handleChangeCarpoolData}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="personality_preference">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="text"
                name="personality_preference"
                id="personality_preference"
                placeholder="Personality preference"
                value={carpoolData.personality_preference}
                onChange={handleChangeCarpoolData}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="occupation_current">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="text"
                name="occupation_current"
                id="occupation_current"
                placeholder="Occupation current"
                value={carpoolData.occupation_current}
                onChange={handleChangeCarpoolData}
                required
              />
            </label>
            <label className="largeLabel" htmlFor="personality_current">
              <input
                className="inputBox w-full p-2 mb-4 border rounded"
                type="text"
                name="personality_current"
                id="personality_current"
                placeholder="Personality current"
                value={carpoolData.personality_current}
                onChange={handleChangeCarpoolData}
                required
              />
            </label>
            <button
              type="submit"
              className="w-full p-2 bg-[#87CEEB] text-[#333333] rounded-lg hover:bg-[#6bb5d8]"
            >
              Submit Ride Details
            </button>
          </form>

          
        </div>
      );
}


export default Map;