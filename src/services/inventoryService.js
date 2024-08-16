const _ = require("lodash");
const Boom = require("@hapi/boom");
const {
  addInventory,
  getLowStockItemsCount,
  getOutOfStockCount,
  getShortExpiryCount,
  getShortExpiryItems,
  findFilteredInventoryAllWarehouses,
} = require("../repositories/inventoryRepository");
const { getWorkplace } = require("../repositories/workplaceRepo");
const { dateAfterNDays } = require("../utils/dateTimeFunctions");
const { warehouseClaimsCountService } = require("./claimsService");
const { uploadToCloudinary } = require("../helpers/imgUploadHelper");
const { convertToWebPBuffer } = require("../helpers/webpConverterHelper");

const inventoryUploadService = async (file) => {
  console.log('File MIME type:', file);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    throw Boom.unsupportedMediaType('Invalid file type. Only jpg, png, jpeg, webp are allowed.');
  }
  const imageBuffer = await file.toBuffer();
  const webpBuffer = (file.mimetype !== 'image/webp') ? await convertToWebPBuffer(imageBuffer) : imageBuffer;
  const upload = await uploadToCloudinary(webpBuffer);
  return upload; // Assuming the URL is stored in 'secure_url'
};

const addInventoryServices = async (file, formData) => {
  console.log("+++++++++++++++++++");
  const imageUrl = await inventoryUploadService(file);

  const inventoryData = {
    ...formData,
    // pack_of: units,
    unit_price: formData.selling_price / formData.units,
    image_url: imageUrl,
  };

  await saveInventoryData(inventoryData);
  return inventoryData;
};

const saveInventoryData = async (inventoryData) => {
  try {
    const savedInventory = await addInventory(inventoryData);
    console.log('Inventory data saved:', savedInventory);
    return savedInventory;
  } catch (error) {
    console.error('Error saving inventory data:', error);
    throw error;
  }
};

const dashboardDetails = async (workplaceId, workplace_type) => {
  const workplace = await getWorkplace({
    id: workplaceId,
    workplace_type,
  });

  if (_.isNil(workplace)) throw Boom.forbidden("The workplace does not exist");

  const dateAfterFifteenDays = dateAfterNDays(15);

  const lowStockItems = await getLowStockItemsCount(workplace.workplace_id);
  const outOfStock = await getOutOfStockCount(workplace.workplace_id);
  const shortExpiry = await getShortExpiryCount(
    workplace.workplace_id,
    dateAfterFifteenDays
  );
  const claims = await warehouseClaimsCountService(workplace.workplace_id);

  const returnObject = {
    lowStockItems: parseInt(lowStockItems.count),
    outOfStock: parseInt(outOfStock.count),
    shortExpiry: shortExpiry,
    claims: parseInt(claims),
  };
  return returnObject;
};

const shortExpiryProuductService = async (workplaceId, workplace_type) => {
  const workplace = await getWorkplace({
    id: workplaceId,
    workplace_type,
  });

  if (_.isNil(workplace)) throw Boom.forbidden("The workplace does not exist");

  const dateAfterFifteenDays = dateAfterNDays(15);

  const shortExpiry = await getShortExpiryItems(
    workplace.workplace_id,
    dateAfterFifteenDays
  );
  return shortExpiry;
};

const warehouseInventory = async (workplaceId, workplace_type, filterBy) => {
  let filter;

  const workplace = await getWorkplace({
    id: workplaceId,
    workplace_type,
  });

  if (_.isNil(workplace)) throw Boom.forbidden("The workplace does not exist");

  const filterConditions = {
    "low-stock": "quantity < low_stock_threshold AND quantity != 0",
    "out-of-stock": { quantity: 0 },
  };

  if (!_.isUndefined(filterBy)) filter = filterConditions[filterBy];

  const data = await findFilteredInventory(workplace.workplace_id, filter);
  return data;
};

const allWarehouseInventory = async (filterBy) => {
  let filter = {};

  const filterConditions = {
    "low-stock":
      '"inventory"."quantity" < "inventory"."low_stock_threshold" AND "inventory"."quantity" != 0',
    "out-of-stock": '"inventory"."quantity" = 0',
    "short-expiry": `"batches"."expiry_date" <= '${dateAfterNDays(
      15
    ).toString()}'`,
  };

  if (!_.isEmpty(filterBy)) {
    filter = filterConditions[filterBy];
  }

  const data = await findFilteredInventoryAllWarehouses(filter);

  return data;
};

const allWarehouseInventoryCount = async () => {
  const results = {};

  // Low Stock
  const lowStockFilter =
    '"inventory"."quantity" < "inventory"."low_stock_threshold" AND "inventory"."quantity" != 0';
  const lowStockData = await findFilteredInventoryAllWarehouses(lowStockFilter);
  results.lowStockCount = lowStockData.length;

  // Out of Stock
  const outOfStockFilter = '"inventory"."quantity" = 0';
  const outOfStockData = await findFilteredInventoryAllWarehouses(
    outOfStockFilter
  );
  results.outOfStockCount = outOfStockData.length;

  // Short Expiry
  const expiryThreshold = `"batches"."expiry_date" <= '${dateAfterNDays(
    15
  ).toString()}'`;
  const shortExpiryData = await findFilteredInventoryAllWarehouses(
    expiryThreshold
  );
  results.shortExpiryCount = shortExpiryData.length;

  return results;
};

module.exports = {
  dashboardDetails,
  warehouseInventory,
  shortExpiryProuductService,
  addInventoryServices,
  inventoryUploadService,
  findFilteredInventoryAllWarehouses,
  allWarehouseInventoryCount,
  allWarehouseInventory,
};
