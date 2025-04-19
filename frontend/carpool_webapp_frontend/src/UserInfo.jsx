import React from "react";
import background from "./assets/forest_road.jpg";
import EmbeddedAddressInput from "./components/EmbeddedAddressInput";

export default function UserInfo({ questions = [], answers = {}, onChange = () => { } }) {
    const find = (label) =>
        questions.find((q) => q.question.toLowerCase().includes(label.toLowerCase()));

    const givenNameQ = find("given");
    const surnameQ = find("surname");
    const sexQ = find("sex");
    const dobQ = find("birth");
    const addressQ = find("primary");

    return (
        <div
            style={{
                backgroundImage: `url(${background})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight: "100vh",
                padding: "5vw",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <div
                style={{
                    backgroundColor: "#F3F0D7",
                    borderRadius: "20px",
                    padding: "40px",
                    width: "100%",
                    maxWidth: "750px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
            >
                <h1
                    style={{
                        textAlign: "center",
                        color: "rgba(32, 56, 17, 0.95)",
                        fontSize: "28px",
                        fontWeight: "600",
                        marginBottom: "8px",
                    }}
                >
                    Let’s Get to Know You
                </h1>
                <p
                    style={{
                        textAlign: "center",
                        fontStyle: "italic",
                        color: "#000",
                        fontSize: "14px",
                        marginBottom: "30px",
                    }}
                >
                    Your information is kept private and secure.
                </p>

                <p
                    style={{
                        fontWeight: "600",
                        color: "#203811",
                        fontSize: "16px",
                        marginBottom: "12px",
                    }}
                >
                    As shown on your Driver’s License:
                </p>

                <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
                    <input
                        className={`input-box full-width ${!answers[givenNameQ?.id] ? "faded-text" : ""}`}
                        placeholder="FIRST NAME"
                        value={answers[givenNameQ?.id] || ""}
                        onChange={(e) => onChange(givenNameQ?.id, e.target.value)}
                    />

                    <input
                        className={`input-box full-width ${!answers[surnameQ?.id] ? "faded-text" : ""}`}
                        placeholder="LAST NAME"
                        value={answers[surnameQ?.id] || ""}
                        onChange={(e) => onChange(surnameQ?.id, e.target.value)}
                    />

                </div>

                <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
                    <select
                        className={`input-box full-width ${!answers[sexQ?.id] ? "faded-text" : ""}`}
                        value={answers[sexQ?.id] || ""}
                        onChange={(e) => onChange(sexQ?.id, e.target.value)}
                    >
                        <option value="">SEX</option>
                        {sexQ?.options.map((opt, idx) => (
                            <option key={idx} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>

                    <input
                        type="date"
                        className="input-box full-width custom-date"
                        value={(() => {
                            try {
                                const [m, d, y] = (answers[dobQ?.id] || "").split("-");
                                return y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
                            } catch {
                                return "";
                            }
                        })()}
                        onChange={(e) => {
                            const [y, m, d] = e.target.value.split("-");
                            onChange(dobQ?.id, `${m}-${d}-${y}`);
                        }}
                    />
                </div>

                <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
                    <div style={{ flex: 1 }}>
                        <EmbeddedAddressInput
                            value={answers[addressQ?.id] || ''}
                            onChange={(val) => onChange(addressQ?.id, val)}
                            placeholder="RESIDENTIAL ADDRESS"
                        />
                    </div>
                </div>





                <style jsx>{`
                    .input-box {
                        background-color: #7E9370;
                        color: white;
                        font-weight: 600;
                        border: none;
                        border-radius: 8px;
                        padding: 14px 20px;
                        font-size: 14px;
                        box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15);
                    }

                    .full-width {
                        width: 100%;
                    }

                    .input-box::placeholder {
                        color: #e7e7e7;
                        text-transform: uppercase;
                    }

                    .input-box:focus {
                        outline: 2px solid #447744;
                    }

                    .custom-date::-webkit-inner-spin-button,
                    .custom-date::-webkit-calendar-picker-indicator {
                        filter: invert(1);
                        cursor: pointer;
                    }

                    .custom-date {
                        font-family: inherit;
                        text-transform: uppercase;
                    }

                    .faded-text {
                        color: rgba(255, 255, 255, 0.75);
                    }
                    `}</style>
            </div>
        </div>
    );
}
