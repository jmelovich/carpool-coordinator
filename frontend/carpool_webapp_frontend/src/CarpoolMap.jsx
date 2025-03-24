  import { useState, useEffect } from 'react';
  import {
    APIProvider,
    Map,
    AdvancedMarker,
    Pin,
    InfoWindow,
    useMapsLibrary,
    useMap
  } from '@vis.gl/react-google-maps';
  import './App.css';

  function CarpoolMap() {

      /*  
      need to implement (put x in brackets when done)
          - feature that allows adding the car's make, license plate, and color
              []  should appear through option of making the user a driver
                  []  most likely another component/asset like in a "CarFeatures.jsx"
                      []  maybe you can use drop downs for a list of the car's make and color, and then text input for license plate 
                          []  make sure license plate has a limited amount of characters 
                          []  (check US license plate character limit, probably 8 or something)
          - map using google maps API
              []  make sure you can specify location and destination using drop map mark
              [x]  account for if the location specified isn't a real location or there isn't a result found
                  [x]  maybe try with a button to confirm the address
                      []  if an address doesn't exist exactly, does there exist a suggested address?
                          []  if yes, then pop open a description if it means that one with a yes/no maybe
                          []  maybe make it clickable such that it replaces the current address field with it
                              [x]  would it account for apartment number?
                          [x] if no, then notify the user of an address not found
                      []  if an address exists exactly, how should an output look like? (design decision)
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
      const [formSubmitted, setformSubmitted] = useState(false);

      // I set this to UF coordinates in Gainesville
      // // maybe set this to a value on average between the two location's addresses
      // // but converted to GPS coordinates after submitting the form
      // // // currently doesn't adjust center of map automatically with any origins and destinations (only addresses in Gainesville)
      // const position = {lat: 29.646839098891597, lng: -82.35332051688552};
      const [position, setPosition] = useState({lat: 29.646839098891597, lng: -82.35332051688552})
      // for setting the zoom level on the map initially
      const [zoom, setZoom] = useState(14);
      // For checking the status of message in the pop up on the google maps pin
      const [open, setOpen] = useState(false);

      const handleChangeCarRideData = (e) => {
          setCarRideData({ ...carRideData, [e.target.name]: e.target.value });
          setformSubmitted(false);
      };

      const handleChangeCarpoolData = (e) => {
          setCarpoolData({ ...carpoolData, [e.target.name]: e.target.value });
      };

      /*  remote this when completed: address checking should be here
          if address is valid, then convert origin and destination to coordinates
      */ 
      const handleMakeCarpool = async (e) => {
        e.preventDefault();
        const isValid = await fetchCoordinates();
        if (!isValid) {
          return
        };

        setformSubmitted(true);
      }

      const geoCoordinates = async (address) => {
        const apiKey = `AIzaSyDtDBuw49kkBUSBnyoS0ulkFVLSoHip9Ec`;
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
        const data = await response.json();
        console.log("data is", data);
        if (data.results.length > 0) {
          return data.results[0].geometry.location;
        }
        else {
          return null;
        } 
      }

      const fetchCoordinates = async () => {
        const originCoords = await geoCoordinates(carRideData.origin);
        console.log("Got origin coords", originCoords);
        const destinationCoords = await geoCoordinates(carRideData.destination);
        console.log("Got destination coords", destinationCoords);

        if (originCoords && destinationCoords && originCoords.lat === destinationCoords.lat && originCoords.lng === destinationCoords.lng) {
          setMessage({ type: "error", text: "Origin address and destination address can't be the same. Please enter two different valid addresses." });
          return false;
        }
        if (!originCoords || !destinationCoords) {
          if (!originCoords && !destinationCoords) {
            setMessage({ type: "error", text: "Origin address and destination address not found. Please enter valid addresses." });
            return false;
          }
          if (!originCoords) {
            setMessage({ type: "error", text: "Origin address not found. Please enter a valid address." });
            return false;
          }
          if (!destinationCoords) {
            setMessage({ type: "error", text: "Destination address not found. Please enter a valid address." });
            return false;
          }
        }

        if (originCoords && destinationCoords) {
          const avgLat = (originCoords.lat + destinationCoords.lat) / 2;
          const avgLng = (originCoords.lng + destinationCoords.lng) / 2;
          setPosition({ lat: avgLat, lng: avgLng });
          console.log("position is: ", position);

          const distance = Math.sqrt(
            (originCoords.lat - destinationCoords.lat) ** 2 +
            (originCoords.lng - destinationCoords.lng) ** 2
          );
          setZoom(distance < 0.05 ? 14 : distance < 0.1 ? 12 : 10);
          console.log("zoom is: ", zoom);
          return true;
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

            {/* might have to remove style options for div in google maps
                apiKey was process.env.REACT_APP_Google_Maps_API_Key
            */}
            {formSubmitted && (
              <APIProvider apiKey={`AIzaSyDtDBuw49kkBUSBnyoS0ulkFVLSoHip9Ec`}>
                <div style={{height: "100vh", width: "100%"}}>
                  <Map 
                    defaultZoom={zoom | 14} 
                    defaultCenter={position | {lat: 29.646839098891597, lng: -82.35332051688552}} 
                    mapId="3ebcfc86407573e4"
                    fullscreenControl={false}
                  >
                    <Directions origin={carRideData.origin} destination={carRideData.destination}/>
                    {/* <AdvancedMarker position={position} onClick={() => setOpen(true)}>
                      <Pin background={"grey"} borderColor={"green"} glyphColor={"purple"}/>
                    </AdvancedMarker>
                    {open && (
                      <InfoWindow position={position} onCloseClick={() => setOpen(false)}>
                        <p>I'm at UF</p>
                      </InfoWindow>
                    )} */}
                  </Map>
                </div>
              </APIProvider>
            )}
          </div>
        );
  }

  function Directions({origin, destination}) {
    const map = useMap();
    const routesLibrary = useMapsLibrary("routes");
    const [directionsService, setDirectionsService] = useState();
    const [directionsRenderer, setDirectionsRenderer] = useState();
    const [routes, setRoutes] = useState([]);
    const [routeIndex, setRouteIndex] = useState(0);
    const selected = routes[routeIndex];
    const leg = selected?.legs[0];

    useEffect(() => {
      if (!routesLibrary || !map) {
        console.log("Routes library or useMap isn't functioning.")
        return
      };
      setDirectionsService(new routesLibrary.DirectionsService());
      setDirectionsRenderer(new routesLibrary.DirectionsRenderer({map}));
    }, [routesLibrary, map]);

    // for testing purposes
    console.log(directionsService);

    useEffect(() => {
      if (!directionsService || !directionsRenderer) {
        console.log("directions service or directions renderer isn't functioning.")
        return
      };

      directionsService.route({
        // origin: "100 Front St, Toronto ON",
        // origin: "686 Museum Rd, Gainesville, FL 32611",
        origin: origin,
        // destination: "500 College St, Toronto ON",
        // destination: "1600 SW Archer Rd, Gainesville, FL 32608",
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      })
      .then(response => {
        directionsRenderer.setDirections(response);
        setRoutes(response.routes);
      })
    }, [directionsService, directionsRenderer, origin, destination])

    console.log(routes);

    useEffect(() => {
      if (!directionsRenderer) {
        console.log("directions renderer isn't functioning.")
        return
      };
      directionsRenderer.setRouteIndex(routeIndex);
    }, [routeIndex, directionsRenderer])

    if (!leg) return null;

    return (
      <div className="directions">
        <h2>{selected.summary}</h2>
        <p>
          {leg.start_address.split(",")[0]} to {leg.end_address.split(",")[0]}
        </p>
        <p>Distance: {leg.distance?.text}</p>
        <p>Duration: {leg.duration?.text}</p>

        <h2>Other Routes</h2>
        <ul>
          {routes.map((route, index) => (
            <li key={route.summary}>
              <button onClick={() => setRouteIndex(index)}>
                {route.summary}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  }

  export default CarpoolMap;