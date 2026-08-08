// @ts-nocheck
import { Router } from "express";
import healthRouter from "./health";
import meetingsRouter from "./meetings";
import pushRouter from "./push";
import webhookRouter from "./webhook";

const router = Router();

router.use(healthRouter);
router.use(meetingsRouter);
router.use(pushRouter);
router.use(webhookRouter);

export default router;
// @ts-nocheck
