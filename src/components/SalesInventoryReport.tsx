import React, { useMemo } from 'react';
import { OperatingExpense, Product, Transaction } from '../types';

interface SalesInventoryReportProps {
  products: Product[];
  transactions: Transaction[];
  operatingExpenses: OperatingExpense[];
  periodType: ReportPeriodType;
  onPeriodTypeChange: (periodType: ReportPeriodType) => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
}

const RESTOCK_THRESHOLD = 10;
const peso = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP`;

const formatReportDate = (date = new Date()) => date.toLocaleDateString('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric', month: 'long', day: 'numeric'
});

const getManilaDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });
  return `${values.year}-${values.month}-${values.day}`;
};

export type ReportPeriodType = 'week' | 'month' | 'year';

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const getReportPeriod = (
  periodType: ReportPeriodType = 'month',
  selectedDate = getManilaDateKey(new Date())
) => {
  const [year, month, day] = selectedDate.split('-').map(Number);
  const selected = new Date(Date.UTC(year, month - 1, day));
  let startDate: string;
  let endDate: string;

  if (periodType === 'week') {
    const daysFromMonday = (selected.getUTCDay() + 6) % 7;
    const start = new Date(selected);
    start.setUTCDate(start.getUTCDate() - daysFromMonday);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    startDate = formatDateKey(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate());
    endDate = formatDateKey(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());
  } else if (periodType === 'year') {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = `${selectedDate.slice(0, 7)}-01`;
    endDate = formatDateKey(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
  }

  const start = new Date(`${startDate}T12:00:00+08:00`);
  const end = new Date(`${endDate}T12:00:00+08:00`);
  const monthLabel = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long' }).format(start);
  const yearLabel = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric' }).format(end);
  const monthStartDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: 'numeric' }).format(start);
  const monthEndDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: 'numeric' }).format(end);
  const weekDateFormat = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const label = periodType === 'year'
    ? yearLabel
    : periodType === 'month'
      ? `${monthLabel} ${monthStartDay}–${monthEndDay}, ${yearLabel}`
      : `${weekDateFormat.format(start)} – ${weekDateFormat.format(end)}`;
  return {
    startDate,
    endDate,
    label,
    shortLabel: label
  };
};

interface ReportPeriodControlsProps {
  periodType: ReportPeriodType;
  onPeriodTypeChange: (periodType: ReportPeriodType) => void;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
}

export function ReportPeriodControls({
  periodType,
  onPeriodTypeChange,
  selectedDate,
  onSelectedDateChange
}: ReportPeriodControlsProps) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
        Report period
        <select
          value={periodType}
          onChange={event => onPeriodTypeChange(event.target.value as ReportPeriodType)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans normal-case tracking-normal text-slate-900"
        >
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
        </select>
      </label>
      {periodType === 'week' && (
        <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
          Select any date in the week
          <input
            type="date"
            value={selectedDate}
            onChange={event => event.target.value && onSelectedDateChange(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans text-slate-900"
          />
        </label>
      )}
      {periodType === 'month' && (
        <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
          Choose month
          <input
            type="month"
            value={selectedDate.slice(0, 7)}
            onChange={event => event.target.value && onSelectedDateChange(`${event.target.value}-01`)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans text-slate-900"
          />
        </label>
      )}
      {periodType === 'year' && (
        <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
          Choose year
          <select
            value={Number(selectedDate.slice(0, 4))}
            onChange={event => onSelectedDateChange(`${event.target.value}-01-01`)}
            className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans text-slate-900"
          >
            {Array.from({ length: currentYear - 1999 }, (_unused, index) => currentYear - index).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

const getTransactionDateKey = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : getManilaDateKey(date);
};

const toTitleCase = (value: string) => value
  .trim()
  .toLocaleLowerCase('en-PH')
  .replace(/(^|[\s-])([a-z])/g, (_match, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`);

const calculateTopSellingProducts = (transactions: Transaction[]) => {
  const products = new Map<string, { name: string; unitsSold: number; sales: number }>();
  transactions.forEach(transaction => {
    transaction.items.forEach(item => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      if (quantity === 0) return;
      const name = item.name.trim() || 'Unnamed Product';
      const key = item.productId || name.toLocaleLowerCase('en-PH');
      const product = products.get(key) || { name, unitsSold: 0, sales: 0 };
      product.unitsSold += quantity;
      const subtotal = Number(item.subtotal);
      product.sales += Number.isFinite(subtotal) ? subtotal : (Number(item.price) || 0) * quantity;
      products.set(key, product);
    });
  });
  return Array.from(products.values())
    .sort((a, b) => b.unitsSold - a.unitsSold || b.sales - a.sales || a.name.localeCompare(b.name))
    .slice(0, 10);
};

export interface FinancialOverview {
  totalSalesRevenue: number;
  totalCostOfGoodsSold: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  netIncome: number;
  uncostedLineItemCount: number;
  operatingExpensesByCategory: { category: string; amount: number }[];
}

export const calculateFinancialOverview = (
  transactions: Transaction[],
  operatingExpenses: OperatingExpense[] = []
): FinancialOverview => {
  const totalSalesRevenue = transactions.reduce((total, transaction) => total + (Number(transaction.total) || 0), 0);
  const costTotals = transactions.reduce((totals, transaction) => {
    transaction.items.forEach(item => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const costPrice = item.costPrice;
      if (costPrice === undefined || costPrice === null || !Number.isFinite(Number(costPrice))) {
        totals.uncostedLineItemCount += 1;
        return;
      }
      totals.total += Math.max(0, Number(costPrice)) * quantity;
    });
    return totals;
  }, { total: 0, uncostedLineItemCount: 0 });
  const operatingExpenseTotals = operatingExpenses.reduce((totals, expense) => {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount < 0) return totals;
    const category = expense.category.trim() || 'Uncategorized';
    totals.total += amount;
    totals.byCategory.set(category, (totals.byCategory.get(category) || 0) + amount);
    return totals;
  }, { total: 0, byCategory: new Map<string, number>() });
  return {
    totalSalesRevenue,
    totalCostOfGoodsSold: costTotals.total,
    grossProfit: totalSalesRevenue - costTotals.total,
    totalOperatingExpenses: operatingExpenseTotals.total,
    netIncome: totalSalesRevenue - costTotals.total - operatingExpenseTotals.total,
    uncostedLineItemCount: costTotals.uncostedLineItemCount,
    operatingExpensesByCategory: Array.from(operatingExpenseTotals.byCategory, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
  };
};

export interface OverviewPrintStats {
  totalRevenue: number;
  totalTransactionsCount: number;
  averageTicket: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface OverviewPrintDocumentProps {
  products: Product[];
  transactions: Transaction[];
  operatingExpenses: OperatingExpense[];
  kpiStats: OverviewPrintStats;
  periodType?: ReportPeriodType;
  selectedDate?: string;
}

export function OverviewPrintDocument({
  products,
  transactions,
  operatingExpenses,
  kpiStats,
  periodType = 'month',
  selectedDate = getManilaDateKey(new Date())
}: OverviewPrintDocumentProps) {
  const period = getReportPeriod(periodType, selectedDate);
  const periodTransactions = transactions.filter(transaction => {
    const dateKey = getTransactionDateKey(transaction.timestamp);
    return dateKey >= period.startDate && dateKey <= period.endDate;
  });
  const periodExpenses = operatingExpenses.filter(expense => expense.date >= period.startDate && expense.date <= period.endDate);
  const todayDate = getManilaDateKey(new Date());
  const todayTransactions = transactions.filter(transaction => getTransactionDateKey(transaction.timestamp) === todayDate);
  const todayExpenses = operatingExpenses.filter(expense => expense.date === todayDate);
  const todayRevenue = todayTransactions.reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0);
  const periodRevenue = periodTransactions.reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0);
  const todayOrderCount = todayTransactions.length;
  const periodOrderCount = periodTransactions.length;
  const todayUnitsSold = todayTransactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0), 0);
  const periodUnitsSold = periodTransactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0), 0);
  const todayOperatingExpenses = todayExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const periodOperatingExpenses = periodExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const todayFinancialOverview = calculateFinancialOverview(todayTransactions, todayExpenses);
  const financialOverview = calculateFinancialOverview(periodTransactions, periodExpenses);
  const periodAverageBasket = periodOrderCount ? periodRevenue / periodOrderCount : 0;
  const topSellingProducts = calculateTopSellingProducts(periodTransactions);
  const restockProducts = products.filter(product => product.stock <= RESTOCK_THRESHOLD).sort((a, b) => a.stock - b.stock);
  const totalUnitsOnHand = products.reduce((sum, product) => sum + Math.max(0, product.stock), 0);
  const inventoryValue = products.reduce((sum, product) => sum + Math.max(0, product.stock) * (product.costPrice ?? 0), 0);
  const restockUnits = restockProducts.reduce((sum, product) => sum + Math.max(0, 20 - product.stock), 0);

  return (
    <article id="overview-print-document" className="overview-print-document">
      <header className="overview-print-header">
        <div>
          <p className="report-kicker">CCAS MOBITRACK</p>
          <h1>Sales Summary Report</h1>
          <p>Official sales performance overview</p>
          <p className="overview-reporting-period"><strong>REPORTING PERIOD</strong><span>Period: {period.label}</span></p>
        </div>
        <dl><dt>DATE</dt><dd>{formatReportDate()}</dd><dt>PREPARED FOR</dt><dd>Management Review</dd></dl>
      </header>
      <div className="overview-print-rule" />

      <section>
        <h2>Overall Operations Overview — Key Performance Indicators</h2>
        <table className="overview-kpi-table"><thead>
          <tr><th rowSpan={2}>METRIC</th><th className="today-column-heading">TODAY&apos;S PERFORMANCE</th><th className="period-column-heading">SELECTED PERIOD</th></tr>
          <tr><th className="today-column-heading">TODAY&apos;S VALUE</th><th className="period-column-heading">{period.label}</th></tr>
        </thead><tbody>
          <tr><th>Total Sales Revenue</th><td className="today-column-value">{peso(todayRevenue)}</td><td className="period-column-value">{peso(periodRevenue)}</td></tr>
          <tr><th>Today&apos;s Completed Orders</th><td className="today-column-value">{todayOrderCount.toLocaleString()}</td><td className="period-column-value">{periodOrderCount.toLocaleString()}</td></tr>
          <tr><th>Average Basket Size</th><td className="today-column-value">{peso(todayOrderCount ? todayRevenue / todayOrderCount : 0)}</td><td className="period-column-value">{peso(periodAverageBasket)}</td></tr>
          <tr><th>Total Units Sold</th><td className="today-column-value">{todayUnitsSold.toLocaleString()}</td><td className="period-column-value">{periodUnitsSold.toLocaleString()}</td></tr>
          <tr><th>Cost of Goods Sold (COGS)</th><td className="today-column-value">{peso(todayFinancialOverview.totalCostOfGoodsSold)}</td><td className="period-column-value">{peso(financialOverview.totalCostOfGoodsSold)}</td></tr>
          <tr><th>Gross Profit</th><td className="today-column-value">{peso(todayFinancialOverview.grossProfit)}</td><td className="period-column-value">{peso(financialOverview.grossProfit)}</td></tr>
          <tr><th>Total Operating Expenses</th><td className="today-column-value">{peso(todayOperatingExpenses)}</td><td className="period-column-value">{peso(periodOperatingExpenses)}</td></tr>
          <tr className="net-income-row"><th>Net Income</th><td className="today-column-value">{peso(todayFinancialOverview.netIncome)}</td><td className="period-column-value">{peso(financialOverview.netIncome)}</td></tr>
        </tbody></table>
        {financialOverview.uncostedLineItemCount > 0 && <p className="overview-print-note"><strong>COGS note:</strong> {financialOverview.uncostedLineItemCount} historical line item(s) have no saved unit cost and are excluded from COGS.</p>}
        <h2>Operating Expense Category Breakdown</h2>
        <table className="overview-expense-table"><thead><tr><th>CATEGORY</th><th>OPERATING EXPENSE</th></tr></thead><tbody>
          {financialOverview.operatingExpensesByCategory.length ? financialOverview.operatingExpensesByCategory.map(row => <tr key={row.category}><td>{toTitleCase(row.category)}</td><td>{peso(row.amount)}</td></tr>) : <tr><td colSpan={2}>No operating expenses recorded for this period.</td></tr>}
        </tbody></table>
      </section>

      <section className="overview-print-page-break">
        <header className="overview-print-header">
          <div><p className="report-kicker">CCAS MOBITRACK</p><h1>Top Selling Products</h1><p>Highest-selling items for the current reporting period</p></div>
          <dl><dt>PERIOD</dt><dd>{period.label}</dd><dt>RANKING</dt><dd>By Units Sold</dd></dl>
        </header>
        <div className="overview-print-rule" />
        <table><thead><tr><th>RANK</th><th>PRODUCT</th><th>UNITS SOLD</th><th>SALES REVENUE</th></tr></thead><tbody>
          {topSellingProducts.length ? topSellingProducts.map((product, index) => <tr key={`${product.name}-${index}`}><td>{index + 1}</td><td>{product.name}</td><td>{product.unitsSold.toLocaleString()}</td><td>{peso(product.sales)}</td></tr>) : <tr><td colSpan={4}>No product sales recorded for this period.</td></tr>}
        </tbody></table>
        <p className="overview-print-note"><strong>Ranking basis:</strong> Products are ranked by total units sold during the reporting period.</p>
      </section>

      <section className="overview-print-page-break">
        <header className="overview-print-header">
          <div><p className="report-kicker">CCAS MOBITRACK</p><h1>Inventory Restock Alert</h1><p>Current stock position and priority replenishment list</p></div>
          <dl><dt>DATE</dt><dd>{formatReportDate()}</dd><dt>PREPARED FOR</dt><dd>Management Review</dd></dl>
        </header>
        <div className="overview-print-rule" />
        <h2>Inventory Overview</h2>
        <table><tbody>
          <tr><th>Restock Flagged Items</th><td>{restockProducts.length} Items</td><td>{kpiStats.outOfStockCount} Out of Reserves</td></tr>
          <tr><th>Total Units on Hand</th><td>{totalUnitsOnHand.toLocaleString()} Units</td><td>Current Available Stock</td></tr>
          <tr><th>Inventory Value (at Cost)</th><td>{peso(inventoryValue)}</td><td>Based on Current Stock</td></tr>
          <tr><th>Recommended Restock</th><td>{restockUnits.toLocaleString()} Units</td><td>Target: 20 Units per Item</td></tr>
        </tbody></table>
        <h2>Priority Restock Table</h2>
        <table><thead><tr><th>ITEM NAME</th><th>UPC / SKU CODE</th><th>CURRENT STOCK</th><th>STATUS</th></tr></thead><tbody>
          {restockProducts.length ? restockProducts.map(product => <tr key={product.id}><td>{product.name}</td><td>{product.barcode || 'N/A'}</td><td>{product.stock.toLocaleString()} Left</td><td className={product.stock === 0 ? 'overview-print-no-stock' : 'overview-print-low'}>{product.stock === 0 ? 'NO STOCK' : 'LOW STOCK'}</td></tr>) : <tr><td colSpan={4}>No products require restocking.</td></tr>}
        </tbody></table>
        <p className="overview-print-note"><strong>Restock rule:</strong> Items with 10 or fewer units are flagged low stock. Items with zero units are marked no stock.</p>
      </section>
      <footer>CCAS MOBITRACK system-generated report</footer>
    </article>
  );
}

export default function SalesInventoryReport({
  products,
  transactions,
  operatingExpenses,
  periodType,
  onPeriodTypeChange,
  selectedDate,
  onSelectedDateChange
}: SalesInventoryReportProps) {
  const report = useMemo(() => {
    const period = getReportPeriod(periodType, selectedDate);
    const periodTransactions = transactions.filter(transaction => {
      const dateKey = getTransactionDateKey(transaction.timestamp);
      return dateKey >= period.startDate && dateKey <= period.endDate;
    });
    const periodExpenses = operatingExpenses.filter(expense => expense.date >= period.startDate && expense.date <= period.endDate);
    const todayDate = getManilaDateKey(new Date());
    const todayTransactions = transactions.filter(transaction => getTransactionDateKey(transaction.timestamp) === todayDate);
    const todayExpenses = operatingExpenses.filter(expense => expense.date === todayDate);
    const periodRevenue = periodTransactions.reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0);
    const todayRevenue = todayTransactions.reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0);
    const periodOperatingExpenses = periodExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const todayOperatingExpenses = todayExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const todayFinancialOverview = calculateFinancialOverview(todayTransactions, todayExpenses);
    const financialOverview = calculateFinancialOverview(periodTransactions, periodExpenses);
    const topSellingProducts = calculateTopSellingProducts(periodTransactions);
    const restockProducts = products.filter(product => product.stock <= RESTOCK_THRESHOLD).sort((a, b) => a.stock - b.stock);
    return {
      period,
      todayRevenue,
      periodRevenue,
      todayOrderCount: todayTransactions.length,
      periodOrderCount: periodTransactions.length,
      todayAverageBasket: todayTransactions.length ? todayRevenue / todayTransactions.length : 0,
      periodAverageBasket: periodTransactions.length ? periodRevenue / periodTransactions.length : 0,
      todayUnitsSold: todayTransactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0), 0),
      periodUnitsSold: periodTransactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0), 0),
      todayOperatingExpenses,
      periodOperatingExpenses,
      todayFinancialOverview,
      financialOverview,
      topSellingProducts,
      restockProducts,
      totalUnitsOnHand: products.reduce((sum, product) => sum + Math.max(0, product.stock), 0),
      inventoryValue: products.reduce((sum, product) => sum + Math.max(0, product.stock) * (product.costPrice ?? 0), 0),
      restockUnits: restockProducts.reduce((sum, product) => sum + Math.max(0, 20 - product.stock), 0)
    };
  }, [products, transactions, operatingExpenses, periodType, selectedDate]);

  return (
    <article id="sales-inventory-report" className="report-document bg-white text-[#18231d]">
      <div className="report-actions print:hidden mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#a8c8b3] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
            Report period
            <select
              value={periodType}
              onChange={event => onPeriodTypeChange(event.target.value as ReportPeriodType)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans normal-case tracking-normal text-slate-900"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
          {periodType === 'week' && (
            <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
              Choose a date in the week
              <input
                type="date"
                value={selectedDate}
                onChange={event => event.target.value && onSelectedDateChange(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans text-slate-900"
              />
            </label>
          )}
          {periodType === 'month' && (
            <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
              Choose month
              <input
                type="month"
                value={selectedDate.slice(0, 7)}
                onChange={event => event.target.value && onSelectedDateChange(`${event.target.value}-01`)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans text-slate-900"
              />
            </label>
          )}
          {periodType === 'year' && (
            <label className="flex flex-col gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
              Choose year
              <select
                value={Number(selectedDate.slice(0, 4))}
                onChange={event => onSelectedDateChange(`${event.target.value}-01-01`)}
                className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-sans text-slate-900"
              >
                {Array.from({ length: new Date().getFullYear() - 1999 }, (_unused, index) => new Date().getFullYear() - index).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          )}
          <p className="pb-2 text-xs text-[#526258]">Selected: <strong>{report.period.label}</strong></p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#176044] px-4 py-2 text-xs font-bold uppercase text-white transition hover:bg-[#0b2e24]"
        >
          Print Report
        </button>
      </div>
      <section className="report-page report-page-operations">
        <header className="report-header">
          <div>
            <p className="report-kicker">CCAS MOBITRACK</p>
            <h1>Overall Operations Overview</h1>
            <p className="report-subtitle">Sales revenue, cost of goods sold, and recorded operating expenses</p>
            <p className="report-period"><strong>REPORTING PERIOD</strong><span>Period: {report.period.label}</span></p>
          </div>
          <div className="report-meta"><strong>Date</strong><span>{formatReportDate()}</span><strong>Prepared for</strong><span>Management Review</span></div>
        </header>

        <div className="report-rule" />
        <h2 className="report-section-title">Key Performance Indicators</h2>
        <table className="report-table report-kpi-table period-kpi-table">
          <thead>
            <tr><th rowSpan={2}>Metric</th><th className="today-column-heading">Today&apos;s Performance</th><th className="period-column-heading">Selected Period</th></tr>
            <tr><th className="today-column-heading">Today&apos;s Value</th><th className="period-column-heading">{report.period.label}</th></tr>
          </thead>
          <tbody>
            <tr><th>Total Sales Revenue</th><td className="today-column-value">{peso(report.todayRevenue)}</td><td className="period-column-value">{peso(report.periodRevenue)}</td></tr>
            <tr><th>Today&apos;s Completed Orders</th><td className="today-column-value">{report.todayOrderCount.toLocaleString()}</td><td className="period-column-value">{report.periodOrderCount.toLocaleString()}</td></tr>
            <tr><th>Average Basket Size</th><td className="today-column-value">{peso(report.todayAverageBasket)}</td><td className="period-column-value">{peso(report.periodAverageBasket)}</td></tr>
            <tr><th>Total Units Sold</th><td className="today-column-value">{report.todayUnitsSold.toLocaleString()}</td><td className="period-column-value">{report.periodUnitsSold.toLocaleString()}</td></tr>
            <tr><th>Cost of Goods Sold (COGS)</th><td className="today-column-value">{peso(report.todayFinancialOverview.totalCostOfGoodsSold)}</td><td className="period-column-value">{peso(report.financialOverview.totalCostOfGoodsSold)}</td></tr>
            <tr><th>Gross Profit</th><td className="today-column-value">{peso(report.todayFinancialOverview.grossProfit)}</td><td className="period-column-value">{peso(report.financialOverview.grossProfit)}</td></tr>
            <tr><th>Total Operating Expenses</th><td className="today-column-value">{peso(report.todayOperatingExpenses)}</td><td className="period-column-value">{peso(report.periodOperatingExpenses)}</td></tr>
            <tr className="net-income-row"><th>Net Income</th><td className="today-column-value">{peso(report.todayFinancialOverview.netIncome)}</td><td className="period-column-value">{peso(report.financialOverview.netIncome)}</td></tr>
          </tbody>
        </table>
        {report.financialOverview.uncostedLineItemCount > 0 && <div className="report-note"><strong>COGS note:</strong> {report.financialOverview.uncostedLineItemCount} historical line item(s) have no saved unit cost and are excluded from COGS.</div>}

        <h2 className="report-section-title report-gap">Operating Expense Category Breakdown</h2>
        <table className="report-table">
          <thead><tr><th>Operating Expense Category</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {report.financialOverview.operatingExpensesByCategory.length ? report.financialOverview.operatingExpensesByCategory.map(row => <tr key={row.category}><td>{toTitleCase(row.category)}</td><td className="text-right">{peso(row.amount)}</td></tr>) : <tr><td colSpan={2}>No operating expenses recorded for this period.</td></tr>}
          </tbody>
        </table>
        <footer className="report-footer"><span>CCAS MOBITRACK system-generated report</span><span>Page 1 of 3</span></footer>
      </section>

      <section className="report-page report-page-top-selling">
        <header className="report-header">
          <div>
            <p className="report-kicker">CCAS MOBITRACK</p>
            <h1>Top Selling Products</h1>
            <p className="report-subtitle">Highest-selling products for the current reporting period</p>
            <p className="report-period"><strong>REPORTING PERIOD</strong><span>Period: {report.period.label}</span></p>
          </div>
          <div className="report-meta"><strong>Ranking</strong><span>By units sold</span><strong>Prepared for</strong><span>Management Review</span></div>
        </header>

        <div className="report-rule" />
        <h2 className="report-section-title">Top 10 by Units Sold</h2>
        <table className="report-table top-selling-table">
          <thead><tr><th className="text-right">Rank</th><th>Product</th><th className="text-right">Units Sold</th><th className="text-right">Sales Revenue</th></tr></thead>
          <tbody>
            {report.topSellingProducts.length ? report.topSellingProducts.map((product, index) => (
              <tr key={`${product.name}-${index}`}><td className="text-right">{index + 1}</td><td>{product.name}</td><td className="text-right">{product.unitsSold.toLocaleString()}</td><td className="text-right">{peso(product.sales)}</td></tr>
            )) : <tr><td colSpan={4}>No product sales recorded for this period.</td></tr>}
          </tbody>
        </table>
        <div className="report-note"><strong>Ranking basis:</strong> Products are ranked by total units sold during the reporting period.</div>
        <footer className="report-footer"><span>CCAS MOBITRACK system-generated report</span><span>Page 2 of 3</span></footer>
      </section>

      <section className="report-page report-page-inventory">
        <header className="report-header">
          <div>
            <p className="report-kicker">CCAS MOBITRACK</p>
            <h1>Inventory Restock Alert</h1>
            <p className="report-subtitle">Current stock position and priority replenishment list</p>
          </div>
          <div className="report-meta"><strong>Date</strong><span>{formatReportDate()}</span><strong>Alert level</strong><span>{report.restockProducts.length ? 'Action Required' : 'No Action Required'}</span></div>
        </header>

        <div className="report-rule" />
        <h2 className="report-section-title">Inventory Overview</h2>
        <table className="report-table report-overview-table">
          <tbody>
            <tr><th>Restock Flagged Items</th><td>{report.restockProducts.length} Items</td><td>{report.restockProducts.filter(product => product.stock <= 0).length} Out of Reserves</td></tr>
            <tr><th>Total Units on Hand</th><td>{report.totalUnitsOnHand.toLocaleString()} Units</td><td>Current Available Stock</td></tr>
            <tr><th>Inventory Value (at Cost)</th><td>{peso(report.inventoryValue)}</td><td>Based on Current Stock</td></tr>
            <tr><th>Recommended Restock</th><td>{report.restockUnits.toLocaleString()} Units</td><td>Target: 20 Units per Item</td></tr>
          </tbody>
        </table>

        <h2 className="report-section-title report-gap">Priority Restock Table</h2>
        <table className="report-table priority-table">
          <thead><tr><th>Item Name</th><th>UPC / SKU Code</th><th className="text-right">Current Stock</th><th>Status</th></tr></thead>
          <tbody>
            {report.restockProducts.length ? report.restockProducts.map(product => <tr key={product.id}><td>{product.name}</td><td>{product.barcode || 'N/A'}</td><td className="text-right">{product.stock.toLocaleString()} Left</td><td className={product.stock === 0 ? 'status-no-stock' : 'status-low'}>{product.stock === 0 ? 'No Stock' : 'Low Stock'}</td></tr>) : <tr><td colSpan={4}>No products require restocking.</td></tr>}
          </tbody>
        </table>

        <div className="report-note"><strong>Restock rule:</strong> Items with 10 or fewer units are flagged low stock. Items with zero units are marked no stock.</div>
        <footer className="report-footer"><span>CCAS MOBITRACK system-generated report</span><span>Page 3 of 3</span></footer>
      </section>
    </article>
  );
}
