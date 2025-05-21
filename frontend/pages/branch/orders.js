import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { jwtDecode } from "jwt-decode";
import { Button, Table, Input, Select, DatePicker, Modal, Space, Tag, message, InputNumber, Typography } from "antd";
import { EditOutlined, EyeOutlined, PrinterOutlined, CheckCircleFilled, EyeFilled, PrinterFilled, CloseSquareFilled, TruckFilled, CheckSquareFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const OrderListPage = ({ branchId }) => {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [productFilter, setProductFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateRange, setDateRange] = useState([null, null]);
  const [dateFilterMode, setDateFilterMode] = useState("created");
  const [loading, setLoading] = useState(false);
  const [visibleModal, setVisibleModal] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleClearFilters = () => {
    setSearchQuery("");
    setBranchFilter("All");
    setStatusFilter("All");
    setProductFilter("All");
    setCategoryFilter("All");
    setDateRange([null, null]);
    setDateFilterMode("created");
    message.success("Filters cleared");
  };

  const getDateRangeAndOrderIds = () => {
    let filteredOrders = orders.filter((order) => order.status === statusFilter);
    
    if (branchFilter !== "All") {
      filteredOrders = filteredOrders.filter((order) => order.branchId?._id === branchFilter);
    }
    
    if (categoryFilter !== "All") {
      filteredOrders = filteredOrders.filter((order) =>
        order.products.some((p) => {
          const product = productCatalog.find(prod => prod.name === p.name);
          return product && product.category?._id === categoryFilter;
        })
      );
    }
    
    if (productFilter !== "All") {
      filteredOrders = filteredOrders.filter((order) =>
        order.products.some((p) => p.name === productFilter)
      );
    }
  
    if (dateRange[0]) {
      const startDate = dayjs(dateRange[0]).startOf("day");
      const endDate = dateRange[1] ? dayjs(dateRange[1]).endOf("day") : dayjs(dateRange[0]).endOf("day");
  
      filteredOrders = filteredOrders.filter((order) => {
        const createdDate = order.createdAt ? dayjs(order.createdAt) : null;
        const deliveryDate = order.deliveryDateTime ? dayjs(order.deliveryDateTime) : null;
  
        if (dateFilterMode === "created") {
          return (
            createdDate &&
            !createdDate.isBefore(startDate) &&
            (!endDate || createdDate.isBefore(endDate))
          );
        }
        if (dateFilterMode === "delivery") {
          return (
            deliveryDate &&
            !deliveryDate.isBefore(startDate) &&
            (!endDate || deliveryDate.isBefore(endDate))
          );
        }
        if (dateFilterMode === "combined") {
          const createdMatch =
            createdDate &&
            !createdDate.isBefore(startDate) &&
            (!endDate || createdDate.isBefore(endDate));
          const deliveryMatch =
            deliveryDate &&
            !deliveryDate.isBefore(startDate) &&
            (!endDate || deliveryDate.isBefore(endDate));
          return createdMatch || deliveryMatch;
        }
        return false;
      });
    }
  
    if (filteredOrders.length === 0) {
      return { earliestCreated: null, latestDelivery: null, orderIds: "" };
    }
  
    const createdDates = filteredOrders
      .map((order) => order.createdAt ? dayjs(order.createdAt) : null)
      .filter(Boolean);
    const deliveryDates = filteredOrders
      .map((order) => order.deliveryDateTime ? dayjs(order.deliveryDateTime) : null)
      .filter(Boolean);
    const orderIds = filteredOrders.map((order) => order.billNo || "N/A").join(", ");
  
    const earliestCreated = createdDates.length > 0
      ? createdDates.reduce((min, date) => (date.isBefore(min) ? date : min))
      : null;
    const latestDelivery = deliveryDates.length > 0
      ? deliveryDates.reduce((max, date) => (date.isAfter(max) ? date : max))
      : null;
  
    return {
      earliestCreated: earliestCreated ? earliestCreated.format("DD/MM/YYYY") : "N/A",
      latestDelivery: latestDelivery ? latestDelivery.format("DD/MM/YYYY") : "N/A",
      orderIds,
    };
  };

  const handleSendingQtyChange = async (index, value) => {
    if (!selectedOrder) return;
  
    const updatedProducts = [...selectedOrder.products];
    updatedProducts[index].sendingQty = value !== null ? value : 0; // Handle null case from InputNumber
  
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ products: updatedProducts }),
      });
  
      if (response.ok) {
        setSelectedOrder({ ...selectedOrder, products: updatedProducts });
        setOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, products: updatedProducts } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, products: updatedProducts } : o))
        );
        message.success("Sending quantity updated successfully");
      } else {
        message.error("Failed to update sending quantity");
      }
    } catch (error) {
      message.error("Error updating sending quantity");
      console.error(error);
    }
  };

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://apib.dinasuvadu.in";

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);

    if (!storedToken) {
      router.replace("/login");
      return;
    }

    try {
      const decoded = jwtDecode(storedToken);
      const role = decoded.role;
      if (!["admin", "superadmin"].includes(role)) {
        router.replace("/login");
        return;
      }
    } catch (error) {
      console.error("Error decoding token:", error);
      router.replace("/login");
      return;
    }

    fetchOrders(storedToken);
    fetchBranches(storedToken);
    fetchCategories(storedToken);
    fetchProducts(storedToken);
  }, [router]);

  const fetchOrders = async (token) => {
    setLoading(true);
    try {
      const url = branchId
        ? `${BACKEND_URL}/api/orders?branchId=${branchId}`
        : `${BACKEND_URL}/api/orders`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setOrders(data);
        setFilteredOrders(data);
        const uniqueProducts = [...new Set(data.flatMap(o => o.products.map(p => p.name)))].sort();
        setProducts(uniqueProducts);
      } else {
        message.error("Failed to fetch orders");
      }
    } catch (error) {
      message.error("Error fetching orders");
      console.error(error);
    }
    setLoading(false);
  };

  const fetchBranches = async (token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setBranches(data);
      } else {
        message.error("Failed to fetch branches");
      }
    } catch (error) {
      message.error("Error fetching branches");
      console.error(error);
    }
  };

  const fetchCategories = async (token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/categories/list-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(Array.isArray(data) ? data : []);
      } else {
        message.error("Failed to fetch categories");
        setCategories([]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      message.error("Error fetching categories");
      setCategories([]);
    }
  };

  const fetchProducts = async (token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setProductCatalog(data);
      } else {
        message.error("Failed to fetch product catalog");
      }
    } catch (error) {
      console.error("Error fetching product catalog:", error);
      message.error("Error fetching product catalog");
    }
  };

  const fetchAssignment = async (branchId, date) => {
    try {
      const formattedDate = dayjs(date).format("YYYY-MM-DD");
      const response = await fetch(`${BACKEND_URL}/api/daily-assignments/${branchId}/by-date/${formattedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        return data;
      } else {
        console.error("Failed to fetch assignment:", data.message);
        return {};
      }
    } catch (error) {
      console.error("Error fetching assignment:", error);
      return {};
    }
  };

  useEffect(() => {
    applyFilters();
  }, [activeTab, searchQuery, branchFilter, statusFilter, productFilter, categoryFilter, dateRange, dateFilterMode, orders]);

  const applyFilters = () => {
    let filtered = [...orders];
    filtered = filtered.filter((order) => order.tab === activeTab);

    if (searchQuery) {
      filtered = filtered.filter((order) =>
        order.billNo && typeof order.billNo === "string"
          ? order.billNo.toLowerCase().includes(searchQuery.toLowerCase())
          : false
      );
    }

    if (branchFilter !== "All") {
      filtered = filtered.filter((order) =>
        order.branchId && order.branchId._id === branchFilter
      );
    }

    if (statusFilter !== "All") {
      filtered = filtered.filter((order) =>
        order.status && order.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (productFilter !== "All") {
      filtered = filtered.filter((order) =>
        order.products.some((p) => p.name === productFilter)
      );
    }

    if (categoryFilter !== "All") {
      filtered = filtered.filter((order) =>
        order.products.some((p) => {
          const product = productCatalog.find(prod => prod.name === p.name);
          return product && product.category?._id === categoryFilter;
        })
      );
    }

    if (dateRange[0]) {
      const startDate = dayjs(dateRange[0]).startOf("day");
      const endDate = dateRange[1] ? dayjs(dateRange[1]).endOf("day") : null;

      filtered = filtered.filter((order) => {
        const createdDate = order.createdAt ? dayjs(order.createdAt) : null;
        const deliveryDate = order.deliveryDateTime ? dayjs(order.deliveryDateTime) : null;

        if (dateFilterMode === "created") {
          return (
            createdDate &&
            !createdDate.isBefore(startDate) &&
            (!endDate || createdDate.isBefore(endDate))
          );
        }
        if (dateFilterMode === "delivery") {
          return (
            deliveryDate &&
            !deliveryDate.isBefore(startDate) &&
            (!endDate || deliveryDate.isBefore(endDate))
          );
        }
        if (dateFilterMode === "combined") {
          const createdMatch =
            createdDate &&
            !createdDate.isBefore(startDate) &&
            (!endDate || createdDate.isBefore(endDate));
          const deliveryMatch =
            deliveryDate &&
            !deliveryDate.isBefore(startDate) &&
            (!endDate || deliveryDate.isBefore(endDate));
          return createdMatch || deliveryMatch;
        }
        return false;
      });
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setFilteredOrders(filtered);
  };

  const handleEdit = async (record) => {
    const assignment = await fetchAssignment(record.branchId._id, record.createdAt);
    setSelectedOrder({ ...record, assignment });
    setIsEditMode(true);
    setVisibleModal(true);
  };

  const handleView = async (record) => {
    const assignment = await fetchAssignment(record.branchId._id, record.createdAt);
    setSelectedOrder({ ...record, assignment });
    setIsEditMode(false);
    setVisibleModal(true);
  };

  const handlePrint = async (record) => {
    const summary = {
      totalQty: record.products.reduce((sum, p) => sum + p.quantity, 0),
      totalItems: record.totalItems,
      subtotal: record.subtotal,
      sgst: record.totalGST / 2,
      cgst: record.totalGST / 2,
      totalWithGST: record.totalWithGST,
      totalWithGSTRounded: Math.round(record.totalWithGST),
      roundOff: Math.round(record.totalWithGST) - record.totalWithGST,
      paymentMethod: record.paymentMethod,
      tenderAmount: Math.round(record.totalWithGST),
      balance: 0,
    };

    const branch = branches.find((b) => b._id === (record.branchId._id || record.branchId));
    const assignment = await fetchAssignment(record.branchId._id, record.createdAt);
    printReceipt(record, summary, branch, assignment);
    message.success("Receipt printed");
  };

  const handleConfirm = async (record) => {
    const isConfirmedState = ["completed", "delivered", "received"].includes(record.status);
    const newStatus = isConfirmedState ? "pending" : "completed";
  
    if (newStatus === "completed") {
      const unconfirmedCount = record.products.filter(p => !p.confirmed).length;
      if (unconfirmedCount > 0) {
        message.error(`Cannot confirm Bill No: ${record.billNo}. ${unconfirmedCount} product(s) are not confirmed.`);
        return;
      }
    }
  
    if (["delivered", "received"].includes(record.status)) {
      message.warning("Order is already delivered or received; status cannot be reverted here.");
      return;
    }
  
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${record._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) => (o._id === record._id ? { ...o, status: newStatus } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === record._id ? { ...o, status: newStatus } : o))
        );
        setSelectedOrder((prev) => (prev && prev._id === record._id ? { ...prev, status: newStatus } : prev));
        message.success(`Order status updated to ${newStatus}`);
      } else {
        message.error("Failed to update order status");
      }
    } catch (error) {
      message.error("Error updating order status");
      console.error(error);
    }
  };
  
  const handleDelivery = async (record) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${record._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "delivered" }),
      });
      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) => (o._id === record._id ? { ...o, status: "delivered" } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === record._id ? { ...o, status: "delivered" } : o))
        );
        setSelectedOrder((prev) => (prev && prev._id === record._id ? { ...prev, status: "delivered" } : prev));
        message.success("Order marked as delivered");
      } else {
        message.error("Failed to mark order as delivered");
      }
    } catch (error) {
      message.error("Error marking order as delivered");
      console.error(error);
    }
  };
  
  const handleReceived = async (record) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${record._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "received" }),
      });
      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) => (o._id === record._id ? { ...o, status: "received" } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === record._id ? { ...o, status: "received" } : o))
        );
        setSelectedOrder((prev) => (prev && prev._id === record._id ? { ...prev, status: "received" } : prev));
        message.success("Order marked as received");
      } else {
        message.error("Failed to mark order as received");
      }
    } catch (error) {
      message.error("Error marking order as received");
      console.error(error);
    }
  };

  const handleSaveSendingQty = async () => {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ products: selectedOrder.products }),
      });

      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...selectedOrder } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...selectedOrder } : o))
        );
        message.success("Sending quantities updated successfully");
        setVisibleModal(false);
      } else {
        message.error("Failed to update sending quantities");
      }
    } catch (error) {
      message.error("Error updating sending quantities");
      console.error(error);
    }
  };

  const handleToggleConfirm = async () => {
    if (!selectedOrder) return;
  
    const isConfirmedState = ["completed", "delivered", "received"].includes(selectedOrder.status);
    const newStatus = isConfirmedState ? "pending" : "completed";
  
    if (newStatus === "completed") {
      const unconfirmedCount = selectedOrder.products.filter(p => !p.confirmed).length;
      if (unconfirmedCount > 0) {
        message.error(`Cannot confirm Bill No: ${selectedOrder.billNo}. ${unconfirmedCount} product(s) are not confirmed.`);
        return;
      }
    }
  
    // No restriction on reverting to "pending" from any status
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
  
      if (response.ok) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
        setOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, status: newStatus } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, status: newStatus } : o))
        );
        message.success(`Order status updated to ${newStatus}`);
      } else {
        message.error("Failed to update order status");
      }
    } catch (error) {
      message.error("Error updating order status");
      console.error(error);
    }
  };

  const handleToggleProductConfirm = async (productIndex) => {
    if (!selectedOrder) return;
  
    const isOrderConfirmed = ["completed", "delivered", "received"].includes(selectedOrder.status);
    if (isOrderConfirmed) {
      message.warning("Cannot change product confirmation status when order is completed, delivered, or received.");
      return;
    }
  
    const updatedProducts = [...selectedOrder.products];
    const currentConfirmed = updatedProducts[productIndex].confirmed || false;
    updatedProducts[productIndex].confirmed = !currentConfirmed;
  
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ products: updatedProducts }),
      });
  
      if (response.ok) {
        setSelectedOrder({ ...selectedOrder, products: updatedProducts });
        setOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, products: updatedProducts } : o))
        );
        setFilteredOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, products: updatedProducts } : o))
        );
        message.success(`Product ${currentConfirmed ? "unconfirmed" : "confirmed"} successfully`);
      } else {
        message.error("Failed to update product confirmation");
      }
    } catch (error) {
      message.error("Error updating product confirmation");
      console.error(error);
    }
  };

  const handlePreview = async () => {
    const combinedData = getCombinedProductData();
    if (combinedData.length === 0) {
      const branchName = branchFilter === "All" ? "all branches" : branches.find(b => b._id === branchFilter)?.name || branchFilter;
      const categoryName = categoryFilter === "All" ? "all categories" : categories.find(c => c._id === categoryFilter)?.name || categoryFilter;
      const productName = productFilter === "All" ? "all products" : productFilter;
      message.info(`No ${statusFilter} orders found for ${categoryName} and ${productName} in ${branchName}.`);
      return;
    }
  
    const updatedOrders = await Promise.all(
      filteredOrders.map(async (order) => {
        const assignment = await fetchAssignment(order.branchId?._id, order.createdAt);
        return { ...order, assignment };
      })
    );
    setFilteredOrders(updatedOrders);
  
    setPreviewModalVisible(true);
  };

  const handlePrintCombined = () => {
    const combinedData = getCombinedProductData();
    if (combinedData.length === 0) {
      const branchName = branchFilter === "All" ? "all branches" : branches.find(b => b._id === branchFilter)?.name || branchFilter;
      const categoryName = categoryFilter === "All" ? "all categories" : categories.find(c => c._id === categoryFilter)?.name || categoryFilter;
      const productName = productFilter === "All" ? "all products" : productFilter;
      message.info(`No ${statusFilter} orders found for ${categoryName} and ${productName} in ${branchName}.`);
      return;
    }
  
    const { earliestCreated, latestDelivery, orderIds } = getDateRangeAndOrderIds();
    const printWindow = window.open("", "_blank");
    const currentDate = dayjs().format("DD/MM/YYYY");
    const branchTitle = branchFilter === "All" ? "All Branches" : branches.find(b => b._id === branchFilter)?.name || branchFilter;
    const categoryTitle = categoryFilter === "All" ? "All Categories" : categories.find(c => c._id === categoryFilter)?.name || categoryFilter;
    const productTitle = productFilter === "All" ? "All Products" : productFilter;
  
    printWindow.document.write(`
      <html>
        <head>
          <title>Combined Product Needs</title>
          <style>
            body { font-family: 'Courier New', monospace; width: 302px; margin: 0; padding: 5px; font-size: 10px; line-height: 1.2; }
            h2 { text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 5px 0; }
            p { margin: 2px 0; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th, td { padding: 2px; text-align: left; font-size: 10px; }
            th { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 5px 0; }
            @media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 5px; } }
          </style>
        </head>
        <body>
          <h2>Combined Product Needs - ${branchTitle} (${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})</h2>
          <p>Order IDs: ${orderIds}</p>
          <p>Category: ${categoryTitle}</p>
          <p>Product: ${productTitle}</p>
          <p>Created Date: ${earliestCreated}</p>
          <p>Delivery Date: ${latestDelivery}</p>
          <p>Date: ${currentDate}</p>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Total Count</th>
                <th>Branch Breakdown</th>
              </tr>
            </thead>
            <tbody>
              ${combinedData
                .map(
                  (item) => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.totalCount}</td>
                  <td>${item.branchBreakdown}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="divider"></div>
          <p>Generated by [App Name] on ${currentDate}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const getCombinedProductData = () => {
    let statusOrders = orders.filter((order) => order.status === statusFilter);
    
    if (branchFilter !== "All") {
      statusOrders = statusOrders.filter((order) => order.branchId?._id === branchFilter);
    }

    if (dateRange[0]) {
      const startDate = dayjs(dateRange[0]).startOf("day");
      const endDate = dateRange[1] ? dayjs(dateRange[1]).endOf("day") : dayjs(dateRange[0]).endOf("day");

      statusOrders = statusOrders.filter((order) => {
        const createdDate = order.createdAt ? dayjs(order.createdAt) : null;
        const deliveryDate = order.deliveryDateTime ? dayjs(order.deliveryDateTime) : null;

        if (dateFilterMode === "created") {
          return (
            createdDate &&
            !createdDate.isBefore(startDate) &&
            (!endDate || createdDate.isBefore(endDate))
          );
        }
        if (dateFilterMode === "delivery") {
          return (
            deliveryDate &&
            !deliveryDate.isBefore(startDate) &&
            (!endDate || deliveryDate.isBefore(endDate))
          );
        }
        if (dateFilterMode === "combined") {
          const createdMatch =
            createdDate &&
            !createdDate.isBefore(startDate) &&
            (!endDate || createdDate.isBefore(endDate));
          const deliveryMatch =
            deliveryDate &&
            !deliveryDate.isBefore(startDate) &&
            (!endDate || deliveryDate.isBefore(endDate));
          return createdMatch || deliveryMatch;
        }
        return false;
      });
    }

    const productMap = {};

    statusOrders.forEach((order) => {
      const branchPrefix = order.branchId?.name?.slice(0, 3).toUpperCase() || "UNK";
      order.products
        .filter((product) => {
          const catalogProduct = productCatalog.find(p => p.name === product.name);
          return !categoryFilter || categoryFilter === "All" || (catalogProduct && catalogProduct.category?._id === categoryFilter);
        })
        .filter((product) => productFilter === "All" || product.name === productFilter)
        .forEach((product) => {
          if (!productMap[product.name]) {
            productMap[product.name] = { totalCount: 0, branches: {} };
          }
          productMap[product.name].totalCount += product.quantity || 0;
          productMap[product.name].branches[branchPrefix] =
            (productMap[product.name].branches[branchPrefix] || 0) + (product.quantity || 0);
        });
    });

    return Object.entries(productMap)
      .map(([productName, data]) => ({
        productName,
        totalCount: data.totalCount,
        branchBreakdown: Object.entries(data.branches)
          .map(([branch, count]) => `${branch}(${count})`)
          .join(" "),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  };

  const columns = [
    { title: "Serial No", render: (_, __, index) => index + 1, width: 80 },
    {
      title: "Order ID",
      dataIndex: "billNo",
      sorter: (a, b) => (a.billNo || "").localeCompare(b.billNo || ""),
      width: 150,
    },
    {
      title: "Branch Name",
      dataIndex: "branchId",
      render: (branchId) => branchId?.name || "Unknown",
      width: 120,
    },
    { title: "Total Items", dataIndex: "totalItems", width: 100 },
    {
      title: "Total Amount",
      dataIndex: "totalWithGST",
      render: (value) => `₹${(value || 0).toFixed(2)}`,
      sorter: (a, b) => (a.totalWithGST || 0) - (b.totalWithGST || 0),
      width: 120,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value) => (
        <Tag
          color={
            value === "completed"
              ? "green"
              : value === "pending"
              ? "yellow"
              : value === "neworder"
              ? "blue"
              : value === "delivered"
              ? "purple"
              : value === "received"
              ? "cyan"
              : "orange"
          }
        >
          {value || "Unknown"}
        </Tag>
      ),
      width: 100,
    },
    {
      title: "Pending Products",
      render: (record) => {
        const pendingCount = record.products.filter(p => !p.confirmed).length;
        return pendingCount;
      },
      width: 120,
    },
    {
      title: "Created & Delivery Date",
      render: (record) => {
        const createdDate = record.createdAt 
          ? dayjs(record.createdAt).tz("Asia/Kolkata").format("DD/MM/YYYY") 
          : "N/A";
        const deliveryDate = record.deliveryDateTime 
          ? dayjs(record.deliveryDateTime).tz("Asia/Kolkata").format("DD/MM/YYYY") 
          : null;
  
        return (
          <div style={{ lineHeight: '1.5' }}>
            <div>Created: {createdDate}</div>
            {deliveryDate && <div>Delivery: {deliveryDate}</div>}
          </div>
        );
      },
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      width: 200,
    },
    {
      title: "Actions",
      render: (record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button icon={<EyeOutlined />} onClick={() => handleView(record)} />
          <Button icon={<PrinterOutlined />} onClick={() => handlePrint(record)} />
        </Space>
      ),
      width: 150,
    },
    {
      title: "Confirm",
      render: (record) => {
        const isConfirmedState = ["completed", "delivered", "received"].includes(record.status);
        return (
          <Button
            type="primary"
            icon={<CheckCircleFilled />}
            danger={!isConfirmedState}
            style={{
              backgroundColor: isConfirmedState ? "#52c41a" : "#ff4d4f",
              borderColor: isConfirmedState ? "#52c41a" : "#ff4d4f",
            }}
            onClick={() => handleConfirm(record)}
          />
        );
      },
      width: 100,
    },
  ];

  const printReceipt = (order, summary, branch, assignment) => {
    const {
      totalQty,
      totalItems,
      subtotal,
      sgst,
      cgst,
      totalWithGST,
      totalWithGSTRounded,
      roundOff,
      paymentMethod,
      tenderAmount,
      balance,
    } = summary;
    const printWindow = window.open("", "_blank");
    
    const createdDate = order.createdAt 
      ? dayjs(order.createdAt).tz("Asia/Kolkata").format("DD/MM/YYYY") 
      : "N/A";
    const deliveryDate = order.deliveryDateTime 
      ? dayjs(order.deliveryDateTime).tz("Asia/Kolkata").format("DD/MM/YYYY") 
      : "N/A";

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; width: 302px; margin: 0; padding: 5px; font-size: 10px; line-height: 1.2; }
            h2 { text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 5px 0; }
            p { margin: 2px 0; overflow: hidden; text-overflow: ellipsis; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th, td { padding: 2px; text-align: left; font-size: 10px; }
            th { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 5px 0; }
            .summary { margin-top: 5px; }
            .summary div { display: flex; justify-content: space-between; }
            .payment-details { margin-top: 5px; }
            @media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 5px; } }
          </style>
        </head>
        <body>
          <h2>${branch?.name || order.branchId?.name || "Unknown Branch"}</h2>
          <p style="text-align: center;">${branch?.address || "Address Not Available"}</p>
          <p style="text-align: center;">${branch?.phoneNo || "Phone Not Available"}</p>
          <p style="text-align: center;">Bill No: ${order.billNo || "N/A"}</p>
          <p style="text-align: center;">Waiter: ${order.waiterId?.name || "N/A"}</p>
          <p style="text-align: center;">Manager: ${assignment.managerId?.name || "N/A"} | Cashier: ${assignment.cashierId?.name || "N/A"}</p>
          <p style="text-align: center;">Created: ${createdDate}</p>
          <p style="text-align: center;">Delivery: ${deliveryDate}</p>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th style="width: 10%;">SL</th>
                <th style="width: 45%;">Description</th>
                <th style="width: 15%;">MRP</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 20%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${
                order.products && Array.isArray(order.products)
                  ? order.products
                      .map(
                        (product, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${product.name || "Unknown"} (${product.quantity || 0}${product.unit || ""})
                  </td>
                  <td>₹${(product.price || 0).toFixed(2)}</td>
                  <td>${product.quantity || 0}</td>
                  <td>₹${(product.productTotal || 0).toFixed(2)}</td>
                </tr>
              `
                      )
                      .join("")
                  : "<tr><td colspan='5'>No products</td></tr>"
              }
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="summary">
            <div><span>Tot Qty:</span><span>${totalQty.toFixed(2)}</span></div>
            <div><span>Tot Items:</span><span>${totalItems}</span></div>
            <div><span>Total Amount:</span><span>₹${subtotal.toFixed(2)}</span></div>
            <div><span>SGST:</span><span>₹${sgst.toFixed(2)}</span></div>
            <div><span>CGST:</span><span>₹${cgst.toFixed(2)}</span></div>
            <div><span>Round Off:</span><span>${roundOff >= 0 ? "+" : ""}${roundOff.toFixed(2)}</span></div>
            <div><span>Net Amt:</span><span>${totalWithGSTRounded.toFixed(2)}</span></div>
          </div>
          <div class="payment-details">
            <p>Payment Details:</p>
            <p>${
              paymentMethod ? paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1) : "N/A"
            } - ₹${totalWithGSTRounded.toFixed(2)}</p>
            <p>Tender: ₹${tenderAmount.toFixed(2)}</p>
            <p>Balance: ₹${balance.toFixed(2)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

 // Keep editModalColumns as previously updated (without brackets)
const editModalColumns = [
  {
    title: "Product Name",
    dataIndex: "name",
    render: (text) => <strong>{text}</strong>,
  },
  { title: "Required Qty", dataIndex: "quantity" },
  { title: "Stock", dataIndex: "bminstock" },
  {
    title: "Sending Qty",
    dataIndex: "sendingQty",
    render: (text, record, index) => (
      <Space>
        <InputNumber
          min={0}
          value={text}
          onChange={(value) => handleSendingQtyChange(index, value)}
        />
        {text !== undefined && record.quantity !== undefined && text !== record.quantity && (
          text > record.quantity ? (
            <span style={{ color: 'green' }}>
              ↑ {text - record.quantity}
            </span>
          ) : (
            <span style={{ color: 'red' }}>
              ↓ {record.quantity - text}
            </span>
          )
        )}
      </Space>
    ),
  },
  { title: "Unit", dataIndex: "unit" },
  {
    title: "Price",
    dataIndex: "price",
    render: (text) => `₹${(text || 0).toFixed(2)}`,
  },
  {
    title: "Total",
    render: (record) => `₹${((record.sendingQty || 0) * (record.price || 0)).toFixed(2)}`,
  },
  {
    title: "Confirm",
    render: (record, _, index) => {
      const isOrderConfirmed = ["completed", "delivered", "received"].includes(selectedOrder.status);
      return (
        <Button
          type="primary"
          icon={<CheckCircleFilled />}
          danger={!record.confirmed}
          disabled={isOrderConfirmed}
          style={{
            backgroundColor: record.confirmed ? "#52c41a" : "#ff4d4f",
            borderColor: record.confirmed ? "#52c41a" : "#ff4d4f",
            color: "#fff",
          }}
          onClick={() => handleToggleProductConfirm(index)}
        />
      );
    },
  },
];

// Updated viewModalColumns with brackets
const viewModalColumns = [
  { title: "Product", dataIndex: "name", render: (value) => value || "Unknown" },
  { 
    title: "Required Qty",
    dataIndex: "quantity", 
    render: (value) => value || 0 
  },
  { 
    title: "BMinStock", 
    dataIndex: "bminstock", 
    render: (value) => value ?? "N/A" 
  },
  { 
    title: "Sending Qty",
    dataIndex: "sendingQty",
    render: (value, record) => (
      <Space>
        <span>{value || 0}</span>
        {value !== undefined && record.quantity !== undefined && value !== record.quantity && (
          value > record.quantity ? (
            <span style={{ color: 'green' }}>
              [↑ {value - record.quantity}]
            </span>
          ) : (
            <span style={{ color: 'red' }}>
              [↓ {record.quantity - value}]
            </span>
          )
        )}
      </Space>
    ),
  },
  { title: "Unit", dataIndex: "unit", render: (value) => value || "" },
  { title: "Price", dataIndex: "price", render: (value) => `₹${(value || 0).toFixed(2)}` },
  { 
    title: "Total", 
    render: (record) => `₹${((record.sendingQty || 0) * (record.price || 0)).toFixed(2)}`
  },
  {
    title: "Confirm",
    dataIndex: "confirmed",
    render: (value) => (
      <Tag color={value ? "green" : "red"}>{value ? "Confirmed" : "Pending"}</Tag>
    ),
  },
];

  const previewColumns = [
    { title: "Product Name", dataIndex: "productName", width: "30%" },
    { title: "Product Total Count", dataIndex: "totalCount", width: "20%" },
    { title: "Branch-wise Breakdown", dataIndex: "branchBreakdown", width: "50%" },
  ];

  const calculateTotals = (products) => {
    return {
      quantity: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
      bminstock: products.reduce((sum, p) => sum + (p.bminstock || 0), 0) || "N/A",
      sendingQty: products.reduce((sum, p) => sum + (p.sendingQty || 0), 0),
      price: products.reduce((sum, p) => sum + (p.price || 0), 0),
      total: products.reduce((sum, p) => sum + ((p.sendingQty || 0) * (p.price || 0)), 0),
    };
  };

  const modalFooter = (products) => {
    const totals = calculateTotals(products || []);
    return (
      <tr style={{ fontWeight: "bold" }}>
        <td>Total</td>
        <td>{totals.quantity}</td>
        <td>{totals.bminstock}</td>
        <td>{totals.sendingQty}</td>
        <td>N/A</td>
        <td>₹{totals.price.toFixed(2)}</td>
        <td>₹{totals.total.toFixed(2)}</td>
        <td></td>
      </tr>
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      <Space direction="vertical" style={{ width: "100%", marginBottom: "20px" }}>
        <Space wrap style={{ marginBottom: "10px" }}>
          <Space>
            <Button
              type={activeTab === "stock" ? "primary" : "default"}
              onClick={() => setActiveTab("stock")}
            >
              Stock Orders
            </Button>
            <Button
              type={activeTab === "liveOrder" ? "primary" : "default"}
              onClick={() => setActiveTab("liveOrder")}
            >
              Live Orders
            </Button>
          </Space>
          <Space>
            <Input
              placeholder="Enter Bill No"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 200 }}
            />
          </Space>
        </Space>

        <Space wrap style={{ marginBottom: "10px" }}>
          <Space direction="vertical">
            <Text strong>Branch:</Text>
            <Select
              value={branchFilter}
              onChange={setBranchFilter}
              style={{ width: 200 }}
              placeholder="Select Branch"
            >
              <Option value="All">All Branches</Option>
              {branches.map((branch) => (
                <Option key={branch._id} value={branch._id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Space>
          <Space direction="vertical">
            <Text strong>Status:</Text>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
            >
              <Option value="All">All</Option>
              <Option value="neworder">New Order</Option>
              <Option value="pending">Pending</Option>
              <Option value="completed">Completed</Option>
              <Option value="delivered">Delivered</Option>
              <Option value="received">Received</Option>
              <Option value="draft">Draft</Option>
            </Select>
          </Space>
          <Space direction="vertical">
            <Text strong>Product:</Text>
            <Select
              value={productFilter}
              onChange={setProductFilter}
              style={{ width: 200 }}
              placeholder="Select Product"
            >
              <Option value="All">All Products</Option>
              {products.map((product) => (
                <Option key={product} value={product}>
                  {product}
                </Option>
              ))}
            </Select>
          </Space>
          <Space direction="vertical">
            <Text strong>Category:</Text>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: 200 }}
              placeholder="Select Category"
            >
              <Option value="All">All Categories</Option>
              {categories.map((category) => (
                <Option key={category._id} value={category._id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Space>
          <Space direction="vertical">
            <Text strong>Date Range:</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates || [null, null])}
              style={{ width: 250 }}
            />
          </Space>
          <Space direction="vertical">
            <Text strong>Date Filter Mode:</Text>
            <Select
              value={dateFilterMode}
              onChange={setDateFilterMode}
              style={{ width: 150 }}
            >
              <Option value="created">Created Date</Option>
              <Option value="delivery">Delivery Date</Option>
              <Option value="combined">Combined</Option>
            </Select>
          </Space>
          <Space direction="vertical">
            <Text strong>For KOT</Text>
            <Space>
              <Button
                type="primary"
                icon={<EyeFilled />}
                onClick={handlePreview}
                style={{ width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              />
              <Button
                type="primary"
                icon={<PrinterFilled />}
                onClick={handlePrintCombined}
                style={{ width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              />
              <Button
                type="primary"
                icon={<CloseSquareFilled />}
                onClick={handleClearFilters}
                style={{ width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              />
            </Space>
          </Space>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowKey="_id"
          scroll={{ x: 1400 }} // Increased to accommodate new columns
        />
      </Space>
      <Modal
      title={
        selectedOrder ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ marginRight: 16 }}>
              Order {selectedOrder.billNo || "N/A"} - {selectedOrder.branchId?.name || "Unknown"} (
              {selectedOrder.status || "Unknown"})
            </span>
            {/* Status Buttons and Active Lines */}
            <Button
              type="primary"
              icon={<CheckCircleFilled />}
              disabled={isEditMode ? !["pending", "neworder", "draft"].includes(selectedOrder.status) && !["completed", "delivered", "received"].includes(selectedOrder.status) : true}
              danger={!["completed", "delivered", "received"].includes(selectedOrder.status)}
              style={{
                backgroundColor: ["completed", "delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : "#ff4d4f",
                borderColor: ["completed", "delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : "#ff4d4f",
                marginRight: 8,
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                color: "#fff", // Ensure white text/icon
              }}
              onClick={isEditMode ? () => handleConfirm(selectedOrder) : undefined}
            >
              Confirm
            </Button>
            <span
              style={{
                width: 20,
                height: 2,
                backgroundColor: ["delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : "#d9d9d9",
                marginRight: 8,
              }}
            />
            <Button
              type="primary"
              icon={<TruckFilled />}
              disabled={isEditMode ? selectedOrder.status !== "completed" && !["delivered", "received"].includes(selectedOrder.status) : true}
              danger={!["delivered", "received"].includes(selectedOrder.status) && selectedOrder.status === "completed"}
              style={{
                backgroundColor: ["delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : (selectedOrder.status === "completed" ? "#ff4d4f" : undefined),
                borderColor: ["delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : (selectedOrder.status === "completed" ? "#ff4d4f" : undefined),
                marginRight: 8,
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                color: "#fff", // Ensure white text/icon
              }}
              onClick={isEditMode ? () => handleDelivery(selectedOrder) : undefined}
            >
              Delivery
            </Button>
            <span
              style={{
                width: 20,
                height: 2,
                backgroundColor: selectedOrder.status === "received" ? "#52c41a" : "#d9d9d9",
                marginRight: 8,
              }}
            />
            <Button
              type="primary"
              icon={<CheckSquareFilled />}
              disabled={isEditMode ? selectedOrder.status !== "delivered" && selectedOrder.status !== "received" : true}
              danger={selectedOrder.status === "delivered" && selectedOrder.status !== "received"}
              style={{
                backgroundColor: selectedOrder.status === "received" ? "#52c41a" : (selectedOrder.status === "delivered" ? "#ff4d4f" : undefined),
                borderColor: selectedOrder.status === "received" ? "#52c41a" : (selectedOrder.status === "delivered" ? "#ff4d4f" : undefined),
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                color: "#fff", // Ensure white text/icon
              }}
              onClick={isEditMode ? () => handleReceived(selectedOrder) : undefined}
            >
              Received
            </Button>
          </div>
        ) : null
      }
      visible={visibleModal}
      onCancel={() => setVisibleModal(false)}
      footer={
        isEditMode
          ? [
              <Button key="cancel" onClick={() => setVisibleModal(false)}>
                Cancel
              </Button>,
              <Button key="save" type="primary" onClick={handleSaveSendingQty}>
                Save
              </Button>,
              <Button
                key="toggleConfirm"
                type="primary"
                danger={!["completed", "delivered", "received"].includes(selectedOrder.status)}
                style={{
                  backgroundColor: ["completed", "delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : "#ff4d4f",
                  borderColor: ["completed", "delivered", "received"].includes(selectedOrder.status) ? "#52c41a" : "#ff4d4f",
                  marginTop: 8,
                }}
                onClick={handleToggleConfirm}
              >
                {["completed", "delivered", "received"].includes(selectedOrder.status) ? "Return" : "Confirm"}
              </Button>,
            ]
          : [
              <Button key="close" onClick={() => setVisibleModal(false)}>
                Close
              </Button>,
            ]
      }
      width={1000}
    >
      {selectedOrder && (
        <div>
          <Space style={{ marginBottom: 8, fontSize: 14 }}>
            <span>Items: {selectedOrder.totalItems || 0}</span>
            <span>|</span>
            <span>Amount: ₹{(selectedOrder.totalWithGST || 0).toFixed(2)}</span>
            <span>|</span>
            <span>
              Payment: {selectedOrder.paymentMethod
                ? selectedOrder.paymentMethod.charAt(0).toUpperCase() + selectedOrder.paymentMethod.slice(1)
                : "N/A"}
            </span>
          </Space>
          <div style={{ marginBottom: 8, fontSize: 14 }}>
            Dates: {selectedOrder.createdAt ? dayjs(selectedOrder.createdAt).format("DD/MM/YYYY") : "N/A"}
            {selectedOrder.deliveryDateTime && ` - ${dayjs(selectedOrder.deliveryDateTime).format("DD/MM/YYYY")}`}
          </div>
          <Space style={{ marginBottom: 16, fontSize: 14 }}>
            <span>Waiter: {selectedOrder.waiterId?.name || "N/A"}</span>
            <span>|</span>
            <span>Manager: {selectedOrder.assignment?.managerId?.name || "N/A"}</span>
            <span>|</span>
            <span>Cashier: {selectedOrder.assignment?.cashierId?.name || "N/A"}</span>
          </Space>
          <Table
            columns={isEditMode ? editModalColumns : viewModalColumns}
            dataSource={selectedOrder.products || []}
            pagination={false}
            rowKey={(record, index) => index}
            footer={() => modalFooter(selectedOrder.products)}
          />
        </div>
      )}
     </Modal>
      <Modal
        title={`Combined Product Needs - ${branchFilter === "All" ? "All Branches" : branches.find(b => b._id === branchFilter)?.name || branchFilter} (${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})`}
        visible={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <Text>
            Category: {categoryFilter === "All" ? "All Categories" : categories.find(c => c._id === categoryFilter)?.name || categoryFilter}, Product: {productFilter === "All" ? "All Products" : productFilter}
          </Text>
          <Text>
            Dates: {getDateRangeAndOrderIds().earliestCreated} - {getDateRangeAndOrderIds().latestDelivery}
          </Text>
          <Text>
            Waiter: {(() => {
              const waiters = [...new Set(filteredOrders.map(order => order.waiterId?.name).filter(Boolean))];
              return waiters.length > 0 ? waiters.join(", ") : "N/A";
            })()} | 
            Manager: {(() => {
              const managers = [...new Set(filteredOrders.map(order => order.assignment?.managerId?.name).filter(Boolean))];
              return managers.length > 0 ? managers.join(", ") : "N/A";
            })()} | 
            Cashier: {(() => {
              const cashiers = [...new Set(filteredOrders.map(order => order.assignment?.cashierId?.name).filter(Boolean))];
              return cashiers.length > 0 ? cashiers.join(", ") : "N/A";
            })()}
          </Text>
        </Space>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text>
            Order IDs:{" "}
            {getDateRangeAndOrderIds().orderIds.split(", ").map((id, index) => {
              const match = id.match(/^([A-Z]{3})(\d{2})(\d{2})(\d{4})$/);
              if (match) {
                const [_, prefix, date, month, year] = match;
                return (
                  <span key={index}>
                    {prefix}<span style={{ fontWeight: 600 }}>{date}</span>{month}{year}
                    {index < getDateRangeAndOrderIds().orderIds.split(", ").length - 1 ? ", " : ""}
                  </span>
                );
              }
              return <span key={index}>{id}{index < getDateRangeAndOrderIds().orderIds.split(", ").length - 1 ? ", " : ""}</span>;
            })}
          </Text>
          <Button
            type="primary"
            icon={<PrinterFilled />}
            onClick={handlePrintCombined}
            style={{ width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          />
        </div>
        <Table
          columns={previewColumns}
          dataSource={getCombinedProductData()}
          pagination={false}
          locale={{ emptyText: `No ${statusFilter} orders found for ${categoryFilter === "All" ? "all categories" : categories.find(c => c._id === categoryFilter)?.name || categoryFilter} across ${branchFilter === "All" ? "all branches" : branches.find(b => b._id === branchFilter)?.name || branchFilter}` }}
          rowKey="productName"
        />
      </Modal>
    </div>
  );
};

export async function getServerSideProps(context) {
  const { query } = context;
  const { branchId } = query;

  return {
    props: {
      branchId: branchId || null,
    },
  };
}

export default OrderListPage;