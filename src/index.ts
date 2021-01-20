import axios from "axios";
import format from "date-fns/format";
import addDays from "date-fns/addDays";
import subDays from "date-fns/subDays";
import isAfter from "date-fns/isAfter";

type StockSymbol = "VEU" | "VOO" | "BIL" | "BND";
type Prices =
  | "1. open"
  | "2. high"
  | "3. low"
  | "4. close"
  | "5. adjusted close";
type DateTimeRange = { from: Date; to: Date };

const closePrice: Prices = "5. adjusted close";

const apiKey = "Q2G9QU2LAAL4ZQXI";

const getData = async (stockSymbol: StockSymbol) => {
  try {
    const { data } = await axios.get(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${stockSymbol}&outputsize=full&apikey=${apiKey}`
    );
    return data["Time Series (Daily)"];
  } catch (error) {
    throw error;
  }
};

type DataEntry = Record<Prices, string>;
type StockData = Record<string, DataEntry>;

const validateLookback = (data: StockData, claimedDate: Date) => {
  const availableEntries = Object.keys(data);
  const firstEntry = new Date(availableEntries[availableEntries.length - 1]);
  console.log(claimedDate, firstEntry);
  return isAfter(claimedDate, firstEntry);
};

const getClosestEntry = (date: Date, data: StockData) => {
  const dateFormat = "yyyy-MM-dd";
  const dateToFind = format(date, dateFormat);
  let result: { value: DataEntry; date: Date };
  if (!validateLookback(data, date)) {
    throw new Error("Lookback extends availabe data");
  }
  if (data?.[dateToFind]) {
    result = { value: data[dateToFind], date: new Date(dateToFind) };
  }
  for (let daysOffset = 1; !result; daysOffset++) {
    const laterDate = format(addDays(date, daysOffset), dateFormat);
    const priorDate = format(subDays(date, daysOffset), dateFormat);
    if (data?.[laterDate]) {
      result = { value: data[laterDate], date: new Date(laterDate) };
    }
    if (data?.[priorDate]) {
      result = { value: data[priorDate], date: new Date(priorDate) };
    }
  }
  return result;
};

const getReturnValue = (
  data: StockData,
  daysBackwards: number,
  now = new Date(),
  calculationPrice: Prices
) => {
  calculationPrice = calculationPrice || closePrice;
  const { value: valueFrom, date: dateFrom } = getClosestEntry(
    subDays(now, daysBackwards),
    data
  );
  const { value: valueTo, date: dateTo } = getClosestEntry(now, data);
  const returnValue =
    (Number(valueTo[calculationPrice]) / Number(valueFrom[calculationPrice])) *
      100 -
    100;
  return { value: returnValue, timeRange: { from: dateFrom, to: dateTo } };
};

const getLookbackReturns = (
  from: Date,
  lookbackRange = 365,
  bilData: StockData,
  vooData: StockData,
  veuData: StockData
) => {
  const bil = getReturnValue(bilData, lookbackRange, from, closePrice);
  const voo = getReturnValue(vooData, lookbackRange, from, closePrice);
  const veu = getReturnValue(veuData, lookbackRange, from, closePrice);
  return { bil, voo, veu };
};

type WalletScheme = {
  lastRevalidation: Date;
  assetSymbol: StockSymbol;
  assetVolume: number;
  transactionCount: number;
};

const calculateGEM = async (range: DateTimeRange, lookback = 365) => {
  const REVALIDATION_INTERVAL = 30;
  try {
    console.log("fetching...");
    const bilData = await getData("BIL");
    const vooData = await getData("VOO");
    const veuData = await getData("VEU");
    const bndData = await getData("BND");
    console.log("ETFs data fetched successfully");

    // const yearlyReturns = getLookbackReturns(
    //   new Date(),
    //   990,
    //   bilData,
    //   vooData,
    //   veuData
    // );
    // console.log(yearlyReturns);

    const wallet: WalletScheme = {
      lastRevalidation: subDays(range.from, REVALIDATION_INTERVAL),
      assetSymbol: "BIL",
      assetVolume: 0,
      transactionCount: 0
    };

    while (
      isAfter(subDays(range.to, REVALIDATION_INTERVAL), wallet.lastRevalidation)
    ) {
      console.log("cycle...");
      const returns = getLookbackReturns(
        new Date(),
        lookback,
        bilData,
        vooData,
        veuData
      );
      if (returns.voo.value < returns.bil.value) {
        // buy BND
        console.log("buy BND");
      } else if (returns.voo.value > returns.veu.value) {
        console.log("buy VOO");
        // buy VOO
      } else {
        console.log("buy VEU");
        // buy VEU
      }
    }
  } catch (error) {
    const { message } = error;
    console.error(
      message || "Error during ETFs data fetching: ",
      message ? "" : error
    );
  }
};

calculateGEM(
  { from: new Date("2018-05-07T00:00:00.000Z,"), to: new Date() },
  365
);
