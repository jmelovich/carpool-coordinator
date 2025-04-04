import React from "react";

const Header = ({ onLogin }) => {
    return (
        <div style={styles.outerWrapper}>
            <div style={styles.innerContainer}>
                <div style={{ flex: 1 }}></div> {/* spacer */}
                <button style={styles.button} onClick={onLogin}>Log In</button>
            </div>
        </div>
    );
};

const styles = {
    outerWrapper: {
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        marginTop: "20px",
    },
    innerContainer: {
        backgroundColor: "#F3F0D7",
        padding: "10px 0px",
        borderRadius: "40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        maxWidth: "900px",
        height: "60px",
        boxSizing: "border-box",
    },
    button: {
        backgroundColor: "#BD961F",
        color: "white",
        border: "none",
        padding: "8px 16px",
        borderRadius: "100px",
        fontWeight: "bold",
        fontSize: "14px",
    },
};

export default Header;
