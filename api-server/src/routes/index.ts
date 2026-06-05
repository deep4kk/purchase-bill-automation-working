import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import erpRouter from "./erp";
import suppliersRouter from "./suppliers";
import itemsRouter from "./items";
import invoicesRouter from "./invoices";
import gstr2bRouter from "./gstr2b";
import reconciliationRouter from "./reconciliation";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(erpRouter);
router.use(suppliersRouter);
router.use(itemsRouter);
router.use(invoicesRouter);
router.use(gstr2bRouter);
router.use(reconciliationRouter);
router.use(dashboardRouter);
router.use(auditRouter);

export default router;
