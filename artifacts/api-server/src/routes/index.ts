import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meetingsRouter from "./meetings";
import aiRouter from "./ai";
import pushRouter from "./push";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meetingsRouter);
router.use(aiRouter);
router.use(pushRouter);
router.use(webhookRouter);

export default router;
