import React from "react";

const Header = ({ onLogin }) => {
    return (
        <div style={styles.wrapper}>
            <div style={styles.container}>
                <div style={{ flex: 1 }}></div> {/* spacer */}
                <button style={styles.button} onClick={onLogin}>Log In</button>
            </div>
        </div>
    );
};

const styles = {
    wrapper: {
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        marginTop: "10px",
        position: "relative",
        zIndex: 2,
    },
    container: {
        width: "75%",
        maxwidth: "1100px",
        height: "60px",
        backgroundColor: "#F3F0D7",
        borderRadius: "999px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 4px",
        boxSizing: "border-box",
        maxWidth: "900px",
    },
    button: {
        backgroundColor: "#BD961F",
        color: "white",
        border: "none",
        padding: "8px 14px",
        borderRadius: "999px",
        fontWeight: "bold",
        fontSize: "clamp(12px, 1vw, 14px)",
        cursor: "pointer",
      },      
};

export default Header;
