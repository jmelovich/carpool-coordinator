import React, { useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

const libraries = ['places'];
const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const EmbeddedAddressInput = ({ value, onChange, placeholder }) => {
  const [address, setAddress] = useState(value || '');
  const [center, setCenter] = useState({ lat: 29.652074, lng: -82.339336 }); // default to Gainesville
  const [marker, setMarker] = useState(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.APP_GOOGLE_MAP_API_KEY || 'AIzaSyC0SI_vabMINqTA9b4mYnjZ069trVujYSo',
    libraries,
  });

  useEffect(() => {
    setAddress(value || '');
  }, [value]);

  useEffect(() => {
    if (isLoaded && inputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
      });
      autocompleteRef.current = autocomplete;
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setCenter({ lat, lng });
          setMarker({ lat, lng });
          const formattedAddress = place.formatted_address;
          setAddress(formattedAddress);
          if (onChange) onChange(formattedAddress);
        }
      });
    }
  }, [isLoaded]);

  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setMarker({ lat, lng });

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const formattedAddress = results[0].formatted_address;
        setAddress(formattedAddress);
        // if (inputRef.current) {
        //   inputRef.current.value = formattedAddress;
        // }
        if (onChange) {
          onChange(formattedAddress);
        }
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input
        ref={inputRef}
        type="text"
        defaultValue={address}
        placeholder={placeholder || "Enter address"}
        className="input-box full-width"
        style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
      />

      <div style={{ borderRadius: "8px", overflow: "hidden" }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={13}
            onClick={handleMapClick}
          >
            {marker && <Marker position={marker} />}
          </GoogleMap>
        ) : (
          <div
            style={{
              height: "300px",
              backgroundColor: "#f0f0f0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: "8px",
            }}
          >
            {loadError ? "Error loading map" : "Loading map..."}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedAddressInput;
