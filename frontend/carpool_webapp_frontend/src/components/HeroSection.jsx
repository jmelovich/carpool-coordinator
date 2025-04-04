import React from "react";
import forestImage from "../assets/forest_road.jpg";

const HeroSection = () => {
  return (
    <div style={styles.wrapper}>
      <div style={styles.container}></div>
    </div>
  );
};

const styles = {
    wrapper: {
        width: "100%",
        display: "flex",
        justifyContent: "center",
        position: "relative",
        top: "-55px", // overlap w header
        zIndex: 1,
      },
      container: {
        width: "90%",
        maxwidth: "1000px",
        aspectRatio: "1.62 / 0.72",
        // height: "615px",
        borderRadius: "50px",
        backgroundImage: `url(${forestImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.9,
        overflow: "hidden",
      },
};

export default HeroSection;
