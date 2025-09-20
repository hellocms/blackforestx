import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Upload, message, Popconfirm, Space, Checkbox, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';

const { Option } = Select;

const CategoryListPage = () => {
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [form] = Form.useForm();
  const router = useRouter();

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://apib.theblackforestcakes.com';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.info('Please log in as Superadmin');
      router.push('/login');
    } else {
      fetchCategories(token);
    }
  }, [router]);

  const fetchCategories = async (token) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/categories/list-categories`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(data);
        applyFilter(data, typeFilter);
      } else {
        message.error('Failed to fetch categories');
      }
    } catch (error) {
      message.error('Error fetching categories');
    }
    setLoading(false);
  };

  const applyFilter = (data, filter) => {
    if (filter === 'pastry') {
      setFilteredCategories(data.filter(category => category.isPastryProduct));
    } else if (filter === 'cake') {
      setFilteredCategories(data.filter(category => category.isCake));
    } else if (filter === 'biling') {
      setFilteredCategories(data.filter(category => category.isBiling));
    } else {
      setFilteredCategories(data);
    }
  };

  const handleTypeFilterChange = (value) => {
    setTypeFilter(value);
    applyFilter(categories, value);
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    form.setFieldsValue({
      name: category.name,
      parent: category.parent?._id || null,
      isPastryProduct: category.isPastryProduct || false,
      isCake: category.isCake || false,
      isBiling: category.isBiling || false,
    });
    setFileList(category.image ? [{
      uid: '-1',
      name: category.image.split('/').pop(),
      status: 'done',
      url: `${BACKEND_URL}/${category.image}`,
    }] : []);
    setPreviewImage(category.image ? `${BACKEND_URL}/${category.image}` : null);
    setEditVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        message.success('Category deleted successfully');
        fetchCategories(token);
      } else {
        const data = await response.json();
        message.error(data.message || 'Failed to delete category');
      }
    } catch (error) {
      message.error('Server error');
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('parent', values.parent || 'null');
    formData.append('isPastryProduct', values.isPastryProduct || false);
    formData.append('isCake', values.isCake || false);
    formData.append('isBiling', values.isBiling || false);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      formData.append('image', fileList[0].originFileObj);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/categories/${selectedCategory._id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        message.success('Category updated successfully');
        setEditVisible(false);
        fetchCategories(token);
      } else {
        message.error(data.message || 'Failed to update category');
      }
    } catch (error) {
      message.error('Server error');
    }
    setLoading(false);
  };

  const handleUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
      setFileList([{ ...file, originFileObj: file }]);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const uploadProps = {
    beforeUpload: handleUpload,
    onRemove: () => {
      setFileList([]);
      setPreviewImage(null);
    },
    fileList,
    showUploadList: false,
  };

  const columns = [
    { 
      title: 'Serial No', 
      key: 'serialNo', 
      width: 80,
      render: (_, __, index) => index + 1,
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Parent Category', 
      dataIndex: ['parent', 'name'], 
      key: 'parent', 
      render: (text) => text || 'None' 
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, record) => {
        const types = [];
        if (record.isPastryProduct) types.push('Pastry');
        if (record.isCake) types.push('Cake');
        if (record.isBiling) types.push('Biling');
        return types.length > 0 ? types.join(', ') : 'None';
      },
    },
    {
      title: 'Image',
      dataIndex: 'image',
      key: 'image',
      render: (image) => image ? (
        <img src={`${BACKEND_URL}/${image}`} alt="Category" style={{ maxWidth: '50px', maxHeight: '50px' }} />
      ) : 'No Image',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm
            title="Are you sure you want to delete this category?"
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Category List</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Select
            value={typeFilter}
            onChange={handleTypeFilterChange}
            style={{ width: 150 }}
            placeholder="Filter by Type"
          >
            <Option value="all">All</Option>
            <Option value="pastry">Pastry</Option>
            <Option value="cake">Cake</Option>
            <Option value="biling">Biling</Option>
          </Select>
          <Button type="primary" onClick={() => router.push('/categories/add')}>
            Create Category
          </Button>
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={filteredCategories}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title="Edit Category"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={onFinish} layout="vertical">
          <Form.Item
            label="Category Name"
            name="name"
            rules={[{ required: true, message: 'Please enter a category name!' }]}
          >
            <Input placeholder="e.g., Pastries" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="isPastryProduct"
                valuePropName="checked"
                rules={[{ required: false }]}
              >
                <Checkbox>Pastry</Checkbox>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="isCake"
                valuePropName="checked"
                rules={[{ required: false }]}
              >
                <Checkbox>Cake</Checkbox>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="isBiling"
                valuePropName="checked"
                rules={[{ required: false }]}
              >
                <Checkbox>Biling</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Parent Category"
            name="parent"
            rules={[{ required: false }]}
          >
            <Select placeholder="Select a parent category" allowClear>
              {categories
                .filter(cat => cat._id !== selectedCategory?._id)
                .map(category => (
                  <Option key={category._id} value={category._id}>{category.name}</Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item label="Category Image">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Upload Image (1 max)</Button>
            </Upload>
            {previewImage && (
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <img src={previewImage} alt="Preview" style={{ maxWidth: '100px', maxHeight: '100px' }} />
                <br />
                <Button 
                  type="link" 
                  onClick={() => { setFileList([]); setPreviewImage(null); }} 
                  style={{ marginTop: '5px' }}
                >
                  Remove
                </Button>
              </div>
            )}
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryListPage;