import React from "react";
import { Layout, Menu, Button, Drawer, Typography, } from "antd";
import Link from "next/link";
import {
  CloseOutlined,
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  DeliveredProcedureOutlined,
  CreditCardOutlined,
  PictureOutlined,
  AppstoreOutlined,
  ShoppingOutlined,
  CoffeeOutlined,
  PlusCircleOutlined,
  CalculatorOutlined,
  TeamOutlined,
  ShopOutlined
} from "@ant-design/icons";

const { Sider } = Layout;
const { Title } = Typography;

// Define your menu items with navigation paths
const menuItems = [
  { key: "dashboard", label: "Dashboard", icon: <DashboardOutlined />, path: "/dashboard" },

  { key: "creating", label: "Creating", isGroup: true },
  { key: "products", label: "Products", icon: <ShoppingOutlined />, path: "/products/List" },
  { key: "pastry", label: "Barcode", icon: <CoffeeOutlined />, path: "/barcode-print" },
  { key: "categories", label: "Categories", icon: <AppstoreOutlined />, path: "/categories/List" },
  { key: "album", label: "Album", icon: <PictureOutlined />, path: "/albums/add" },




  { key: "report", label: "Report", isGroup: true },
  { key: "addons", label: "Billing", icon: <FileTextOutlined  />, path: "/branch/BillingOrdersPage" },
  { key: "addons", label: "Waiter", icon: <FileTextOutlined  />, path: "/branch/WaiterBillsManagementPage" },
  { key: "Closingentry", label: "Closingentry", icon: <FileTextOutlined />, path: "/dealers/closing-entry/list" },
  { key: "Expense List", label: "Expense List", icon: <FileTextOutlined />, path: "/dealers/closing-entry/expenselist" },
  { key: "DealerBills", label: "DealerBills", icon: <FileTextOutlined />, path: "/dealers/bill-entry/list" },
  { key: "delivery", label: "Company", icon: <DeliveredProcedureOutlined />, path: "/dealers/companyForm" },
  { key: "delivery", label: "Dealer", icon: <DeliveredProcedureOutlined />, path: "/dealers/list" },
  { key: "payments", label: "FinancialManagement", icon: <CreditCardOutlined />, path: "/BankClosingEntryList", newTab: true },


  { key: "others_2", label: "Account Creations", isGroup: true },
  { key: "addons", label: "Branches", icon: <PlusCircleOutlined />, path: "/branch/list" },
  { key: "stores", label: "registeration", icon: <ShopOutlined />, path: "/register", newTab: true },
  { key: "units", label: "User List", icon: <CalculatorOutlined />, path: "/user/List" },
  { key: "units", label: "Employees", icon: <CalculatorOutlined />, path: "/employees/List" },
];

const Sidebar = ({ collapsed, toggleSidebar, isMobile, mobileVisible, closeMobileSidebar }) => {
  return (
    <>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={220}
          style={{
            background: "#fff",
            minHeight: "100vh",
            paddingTop: "10px",
            overflowY: "auto",
            maxHeight: "100vh",
            position: "fixed",
            left: 0,
            borderRight: "1px solid #ddd"
          }}
        >
          <Menu mode="inline" style={{ borderRight: 0, background: "#fff" }}>
            {menuItems.map((item) =>
              item.isGroup ? (
                <Menu.ItemGroup
                  key={item.key}
                  title={
                    collapsed
                      ? null
                      : (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#aaa",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            padding: "5px 15px"
                          }}
                        >
                          {item.label}
                        </span>
                      )
                  }
                />
              ) : (
                <Menu.Item key={item.key} icon={<span style={{ color: "#888" }}>{item.icon}</span>}>
                  {item.newTab ? (
                    <a href={item.path} target="_blank" rel="noopener noreferrer" style={{ color: "#333", textDecoration: "none" }}>
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.path} style={{ color: "#333", textDecoration: "none" }}>
                      {item.label}
                    </Link>
                  )}
                </Menu.Item>
              )
            )}
          </Menu>
        </Sider>
      )}

      {/* Mobile Sidebar (Drawer) */}
      <Drawer
        placement="left"
        closable={false}
        onClose={closeMobileSidebar}
        visible={mobileVisible}
        width={220}
        bodyStyle={{ padding: 0, background: "#fff" }}
      >
        {/* Mobile Sidebar Header with Close Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "#fff",
            borderBottom: "1px solid #ddd"
          }}
        >
          <Title level={5} style={{ color: "#333", margin: 0 }}>
            Menu
          </Title>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={closeMobileSidebar}
            style={{
              fontSize: "18px",
              color: "#333"
            }}
          />
        </div>

        {/* Menu Items */}
        <Menu theme="light" mode="inline">
          {menuItems.map((item) =>
            item.isGroup ? (
              <Menu.ItemGroup key={item.key} title={<span style={{ fontSize: "12px", color: "#aaa", fontWeight: "bold" }}>{item.label}</span>} />
            ) : (
              <Menu.Item key={item.key} icon={<span style={{ color: "#888" }}>{item.icon}</span>}>
                {item.newTab ? (
                  <a href={item.path} target="_blank" rel="noopener noreferrer" style={{ color: "#333", textDecoration: "none" }}>
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.path} style={{ color: "#333", textDecoration: "none" }}>
                    {item.label}
                  </Link>
                )}
              </Menu.Item>
            )
          )}
        </Menu>
      </Drawer>
    </>
  );
};

export default Sidebar;
