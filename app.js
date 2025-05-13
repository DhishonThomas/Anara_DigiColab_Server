import express from "express";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connection } from "./database/dbConnection.js";
import { errorMiddleware } from "./middlewares/error.js";
import userRouter from "./routes/userRouter.js";
import volunteerRouter from "./routes/volunteerRouter.js";
import adminPaymentRouter from "./routes/adminPaymentRouter.js"
import adminRouter from "./routes/adminRouter.js";
import { removeUnverifiedAccounts } from "./automation/removeUnverifiedAccounts.js";
import path from "path";
import { fileURLToPath } from "url";
import volunteerPaymentRouter from "./routes/volunteerPaymentRouter.js";
import uploadRouter from './routes/uploadRoutes.js';
import letterheadPdfRoutes from './routes/letterheadPdfRoutes.js'


export const app = express();
config({ path: "./config.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:4000",
  "https://skills.anaraskills.org",
  "https://digi-colab-roan.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
};

app.use(cors(corsOptions));              // ✅ Attach CORS middleware
app.options("*", cors(corsOptions));     // ✅ Handle preflight requests


app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/user", userRouter);
app.use("/api/v1/volunteer", volunteerRouter);
app.use("/api/v1/admin", adminRouter);
app.use('/api/v1/payment-requests', volunteerPaymentRouter);
app.use('/api/v1/admin/payment-requests', adminPaymentRouter);
app.use('/api/v1/admin/uploads', uploadRouter);

app.use('/api/v1/admin/pdf',letterheadPdfRoutes);
removeUnverifiedAccounts();
connection();

app.use(errorMiddleware);