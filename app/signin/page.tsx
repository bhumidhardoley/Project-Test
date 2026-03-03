import Link from "next/link";
export default function App() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f4f4f4",
      }}
    >
      <form
        style={{
          backgroundColor: "#ffffff",
          padding: "25px",
          borderRadius: "8px",
          width: "280px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ textAlign: "center", marginBottom: "15px" }}>
          Sign In
        </h3>

        <label htmlFor="username">Username</label>
        <input
          type="text"
          style={{
            width: "100%",
            padding: "6px",
            margin: "5px 0 12px 0",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />

        <label htmlFor="password">Password</label>
        <input
          type="password"
          style={{
            width: "100%",
            padding: "6px",
            margin: "5px 0 15px 0",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "#333",
            color: "#fff",
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          Submit
        </button>

        <p style={{ textAlign: "center", fontSize: "14px" }}>
          Don't have an account?
        </p>

        <button
          type="button"
          style={{
            width: "100%",
            padding: "6px",
            borderRadius: "4px",
            border: "1px solid #333",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        >
           <Link href="/signup" style={{
                textDecoration: 'none'
            }}> Sign UP</Link>
        </button>
      </form>
    </div>
  );
}