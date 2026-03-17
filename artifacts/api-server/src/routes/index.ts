import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meetingsRouter from "./meetings";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meetingsRouter);
router.use(aiRouter);

export default router;
