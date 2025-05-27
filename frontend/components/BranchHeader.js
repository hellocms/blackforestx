import React, { useState, useEffect } from 'react';
import { Layout, Space, Typography, Button, message } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode';

const { Header } = Layout;
const { Text } = Typography;

const BranchHeader = () => {
  const [branchName, setBranchName] = useState('');
  const router = useRouter();

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.dinasuvadu.in';

  // Copy-pasted from your product bill page
  const fetchBranchDetails = async (token, branchId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/branches`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const branch = data.find(b => b._id === branchId);
        if (branch) {
          setBranchName(branch.name || 'Unknown Branch');
        } else {
          message.error('Branch not found');
          setBranchName('Unknown Branch');
        }
      } else {
        message.error('Failed to fetch branches');
        setBranchName('Unknown Branch');
      }
    } catch (error) {
      console.error('Fetch branches error:', error);
      message.error('Error fetching branches');
      setBranchName('Unknown Branch');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded.branchId) {
        fetchBranchDetails(token, decoded.branchId);
      } else {
        setBranchName('Unknown Branch');
      }
    } catch (error) {
      setBranchName('Unknown Branch');
      router.push('/login');
    }
  }, [router]);

  return (
    <Header
      style={{
        background: '#000000',
        padding: '0 20px',
        color: '#FFFFFF',
        height: '64px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Space align="center">
          <UserOutlined style={{ fontSize: '16px', color: '#FFFFFF' }} />
          <Text style={{ fontSize: '14px', color: '#FFFFFF' }}>
            {branchName}
          </Text>
        </Space>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          style={{ fontSize: '16px', color: '#FFFFFF' }}
        >
          Logout
        </Button>
      </div>
    </Header>
  );
};

export default BranchHeader;
