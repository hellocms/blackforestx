import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Input, Typography, Space, Card, Spin, Radio } from 'antd';
import { RedoOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement } from 'chart.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement);

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;
const { Search } = Input;
const { Group: RadioGroup, Button: RadioButton } = Radio;

const ExpenseEntry = () => {
  const [closingEntries, setClosingEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [branchFilter, setBranchFilter] = useState(null);
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [lineGraphView, setLineGraphView] = useState('branch');

  const expenseCategories = [
    'MAINTENANCE',
    'TRANSPORT',
    'FUEL',
    'PACKING',
    'STAFF WELFARE',
    'ADVERTISEMENT',
    'ADVANCE',
    'OTHERS',
  ];

  useEffect(() => {
    fetchBranches();
    fetchClosingEntries();
  }, []);

  useEffect(() => {
    let filtered = [...closingEntries];

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((entry) => {
        const branchMatch = entry.branchId?.name?.toLowerCase().includes(searchLower);
        const expenseMatch = entry.expenseDetails.some((detail) => {
          const recipientMatch = detail.recipient?.toLowerCase().includes(searchLower);
          const amountMatch = detail.amount?.toString().includes(searchLower);
          const reasonMatch = detail.reason?.toLowerCase().includes(searchLower);
          return recipientMatch || amountMatch || reasonMatch;
        });
        return branchMatch || expenseMatch;
      });
    }

    if (branchFilter) {
      filtered = filtered.filter((entry) => entry.branchId?._id === branchFilter);
    }

    if (dateRangeFilter && dateRangeFilter.length === 2) {
      const startDate = dayjs(dateRangeFilter[0]).startOf('day');
      const endDate = dayjs(dateRangeFilter[1]).endOf('day');
      filtered = filtered.filter((entry) => {
        const entryDate = dayjs(entry.date);
        return entryDate.isValid() && entryDate.isBetween(startDate, endDate, null, '[]');
      });
    }

    if (categoryFilter) {
      filtered = filtered.filter((entry) =>
        entry.expenseDetails.some((detail) => detail.reason === categoryFilter)
      );
    }

    setFilteredEntries(filtered);
  }, [closingEntries, searchText, branchFilter, dateRangeFilter, categoryFilter]);

  const fetchBranches = async () => {
    try {
      const response = await fetch('https://apib.dinasuvadu.in/api/branches/public', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setBranches(result);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchClosingEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://apib.dinasuvadu.in/api/closing-entries', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setClosingEntries(result);
        setFilteredEntries(result);
      }
    } catch (err) {
      console.error('Error fetching closing entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchText('');
    setBranchFilter(null);
    setDateRangeFilter(null);
    setCategoryFilter(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const branchChartData = useMemo(() => {
    const branchTotals = {};
    let totalExpenses = 0;

    filteredEntries.forEach((entry) => {
      const branchName = entry.branchId?.name || 'Unknown Branch';
      const expense = entry.expenses || 0;
      branchTotals[branchName] = (branchTotals[branchName] || 0) + expense;
      totalExpenses += expense;
    });

    const labels = [];
    const data = [];
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#C9CBCF',
      '#7BC225',
    ];

    Object.entries(branchTotals).forEach(([branchName, amount], index) => {
      const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(2) : 0;
      labels.push(`${branchName}: ${percentage}%`);
      data.push(amount);
    });

    console.log('Branch Chart Labels:', labels);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredEntries]);

  const categoryChartData = useMemo(() => {
    const categoryTotals = {};
    let totalCategoryExpenses = 0;

    filteredEntries.forEach((entry) => {
      entry.expenseDetails.forEach((detail) => {
        const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
        const amount = detail.amount || 0;
        categoryTotals[reason] = (categoryTotals[reason] || 0) + amount;
        totalCategoryExpenses += amount;
      });
    });

    const labels = [];
    const data = [];
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#C9CBCF',
      '#7BC225',
    ];

    const allCategories = [...expenseCategories];
    allCategories.forEach((category) => {
      const amount = categoryTotals[category] || 0;
      const percentage = totalCategoryExpenses > 0 ? ((amount / totalCategoryExpenses) * 100).toFixed(2) : 0;
      if (amount > 0) {
        labels.push(`${category}: ${percentage}%`);
        data.push(amount);
      }
    });

    console.log('Category Chart Labels:', labels);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredEntries]);

  const chartOptions = {
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: {
            weight: 'bold',
          },
          boxWidth: 20,
          padding: 10,
          usePointStyle: false,
          generateLabels: (chart) => {
            const { data } = chart;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const meta = chart.getDatasetMeta(0);
                const style = meta.controller.getStyle(i);
                const [name, percentage] = label.split(': ');
                return {
                  text: [name, `: ${percentage}`],
                  fillStyle: style.backgroundColor,
                  strokeStyle: style.borderColor,
                  lineWidth: style.borderWidth,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            }
            return [];
          },
        },
        maxWidth: 250,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ₹${value} (${percentage}%)`;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  // Prepare data for the line graph
  const lineChartData = useMemo(() => {
    const dateEntries = filteredEntries.map(entry => ({
      date: dayjs(entry.date),
      entry,
    }));

    if (!dateEntries.length) {
      return { labels: [], datasets: [] };
    }

    // Use current date (May 21, 2025) to determine the month and year
    const currentDate = dayjs('2025-05-21'); // Fixed for consistency with the given date
    const targetMonth = currentDate.month(); // 4 (May)
    const targetYear = currentDate.year(); // 2025
    const daysInMonth = currentDate.daysInMonth(); // 31 for May
    const currentDay = currentDate.date(); // 21

    // Create labels from 1 to current day
    const labels = Array.from({ length: currentDay }, (_, i) => (i + 1).toString());

    const dateMap = {};
    labels.forEach(day => {
      dateMap[day] = [];
    });

    dateEntries.forEach(({ date, entry }) => {
      // Include entries from the current month and year, up to today
      if (
        date.month() === targetMonth &&
        date.year() === targetYear &&
        date.date() <= currentDay
      ) {
        const day = date.date().toString();
        dateMap[day].push(entry);
      }
    });

    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#C9CBCF',
      '#7BC225',
    ];

    let datasets = [];

    if (lineGraphView === 'branch') {
      const branchData = {};

      Object.keys(dateMap).forEach(day => {
        const entries = dateMap[day];
        entries.forEach(entry => {
          const branchName = entry.branchId?.name || 'Unknown Branch';
          if (!branchData[branchName]) {
            branchData[branchName] = Array(currentDay).fill(0);
          }
          const dayIndex = parseInt(day) - 1;
          branchData[branchName][dayIndex] += entry.expenses || 0;
        });
      });

      datasets = Object.keys(branchData).map((branchName, index) => ({
        label: branchName,
        data: branchData[branchName],
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        fill: false,
        tension: 0.1,
      }));
    } else {
      const categoryData = {};

      Object.keys(dateMap).forEach(day => {
        const entries = dateMap[day];
        entries.forEach(entry => {
          entry.expenseDetails.forEach(detail => {
            const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
            if (!categoryData[reason]) {
              categoryData[reason] = Array(currentDay).fill(0);
            }
            const dayIndex = parseInt(day) - 1;
            categoryData[reason][dayIndex] += detail.amount || 0;
          });
        });
      });

      datasets = Object.keys(categoryData).map((category, index) => ({
        label: category,
        data: categoryData[category],
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        fill: false,
        tension: 0.1,
      }));
    }

    console.log('Line Chart Data:', { labels, datasets });

    return {
      labels,
      datasets,
    };
  }, [filteredEntries, lineGraphView]);

  const lineChartOptions = {
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            weight: 'bold',
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.raw || 0;
            return `${label}: ₹${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Day of Month',
          font: {
            weight: 'bold',
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amount (₹)',
          font: {
            weight: 'bold',
          },
        },
        beginAtZero: true,
      },
    },
    maintainAspectRatio: false,
  };

  const columns = [
    {
      title: 'Serial No',
      key: 'sno',
      render: (text, record, index) => index + 1,
      width: 80,
    },
    {
      title: 'Branch',
      dataIndex: ['branchId', 'name'],
      key: 'branch',
      render: (value) => value || 'N/A',
      width: 120,
    },
    {
      title: 'Total Expense',
      dataIndex: 'expenses',
      key: 'totalExpense',
      render: (value) => `₹${value || 0}`,
      width: 120,
    },
    {
      title: 'Maintenance',
      key: 'maintenance',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'MAINTENANCE');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Transport',
      key: 'transport',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'TRANSPORT');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Fuel',
      key: 'fuel',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'FUEL');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Packing',
      key: 'packing',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'PACKING');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Staff Welfare',
      key: 'staffWelfare',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'STAFF WELFARE');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Advertisement',
      key: 'advertisement',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'ADVERTISEMENT');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Advance',
      key: 'advance',
      render: (record) => {
        const expenses = record.expenseDetails.filter((d) => d.reason === 'ADVANCE');
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Others',
      key: 'others',
      render: (record) => {
        const expenses = record.expenseDetails.filter(
          (d) => !expenseCategories.includes(d.reason) || d.reason === 'OTHERS'
        );
        return expenses.length > 0 ? (
          expenses.map((exp, index) => (
            <React.Fragment key={index}>
              {exp.recipient || 'N/A'}: <strong>₹${exp.amount || 0}</strong>
              {index < expenses.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          '-'
        );
      },
      width: 150,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      width: 100,
    },
  ];

  return (
    <div
      style={{
        padding: '40px 20px',
        background: 'linear-gradient(to bottom, #f0f2f5, #e6e9f0)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <style>
        {`
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            .filter-section, .line-chart-section {
              display: none;
            }
            .table-section, .charts-section {
              width: 100%;
              margin: 0;
              box-shadow: none;
              border: none;
              page-break-inside: avoid;
            }
            .ant-table {
              font-size: 10px;
            }
            .ant-table th, .ant-table td {
              padding: 4px !important;
            }
            .charts-section {
              display: flex;
              justify-content: space-around;
              page-break-before: auto;
            }
            .chart-container {
              width: 300px !important;
              height: 300px !important;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
          }
          .circle-radio .ant-radio-button-wrapper {
            border-radius: 50%;
            width: 120px;
            height: 40px;
            line-height: 40px;
            text-align: center;
            border: 1px solid #d9d9d9;
            margin-right: 10px;
            transition: all 0.3s;
          }
          .circle-radio .ant-radio-button-wrapper-checked {
            background-color: #1890ff;
            color: #fff;
            border-color: #1890ff;
          }
          .circle-radio .ant-radio-button-wrapper:hover {
            background-color: #e6f7ff;
            border-color: #1890ff;
          }
          .line-chart-container {
            width: 90vw;
            max-width: 1400px;
            height: 60vh;
            min-height: 500px;
            min-width: 800px;
            margin: 0 auto;
          }
          @media (max-width: 1024px) {
            .line-chart-container {
              width: 95vw;
              min-width: 600px;
              height: 50vh;
              min-height: 400px;
            }
          }
          @media (max-width: 768px) {
            .line-chart-container {
              width: 98vw;
              min-width: 400px;
              height: 40vh;
              min-height: 350px;
            }
          }
          @media (max-width: 480px) {
            .line-chart-container {
              width: 98vw;
              min-width: 300px;
              height: 35vh;
              min-height: 300px;
            }
          }
        `}
      </style>
      <div style={{ maxWidth: '1600px', width: '100%' }}>
        <Card
          className="filter-section"
          style={{
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            background: '#fafafa',
            marginBottom: '20px',
            border: '1px solid #e8e8e8',
          }}
        >
          <Space
            direction="horizontal"
            wrap
            style={{
              width: '100%',
              padding: '15px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Space wrap>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Search
                </Text>
                <Search
                  placeholder="Search by branch, recipient, amount, or reason"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '200px' }}
                  allowClear
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Branch Filter
                </Text>
                <Select
                  placeholder="All Branches"
                  value={branchFilter}
                  onChange={(value) => setBranchFilter(value)}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value={null}>All Branches</Option>
                  {branches.map((branch) => (
                    <Option key={branch._id} value={branch._id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Date Range
                </Text>
                <RangePicker
                  value={dateRangeFilter}
                  onChange={(dates) => setDateRangeFilter(dates)}
                  format="YYYY-MM-DD"
                  style={{ width: '250px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong style={{ marginBottom: '5px' }}>
                  Expense Category
                </Text>
                <Select
                  placeholder="All Categories"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value)}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value={null}>All Categories</Option>
                  <Option value="MAINTENANCE">Maintenance</Option>
                  <Option value="TRANSPORT">Transport</Option>
                  <Option value="FUEL">Fuel</Option>
                  <Option value="PACKING">Packing</Option>
                  <Option value="STAFF WELFARE">Staff Welfare</Option>
                  <Option value="ADVERTISEMENT">Advertisement</Option>
                  <Option value="ADVANCE">Advance</Option>
                  <Option value="OTHERS">Others</Option>
                </Select>
              </div>
            </Space>

            <Space>
              <Button type="default" icon={<RedoOutlined />} onClick={handleReset}>
                Reset
              </Button>
              <Button
                type="default"
                icon={<FileTextOutlined />}
                href="/dealers/closing-entry/list"
              >
                Closing Entry List
              </Button>
              <Button type="default" icon={<PrinterOutlined />} onClick={handlePrint}>
                Print
              </Button>
            </Space>
          </Space>
        </Card>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Card
              className="table-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              <Table
                columns={columns}
                dataSource={filteredEntries}
                rowKey="_id"
                pagination={{ pageSize: 10 }}
                bordered
                scroll={{ x: 'max-content' }}
              />
            </Card>

            <Card
              className="charts-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              {filteredEntries.length > 0 ? (
                <Space
                  direction="horizontal"
                  style={{
                    width: '100%',
                    padding: '20px',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                  }}
                >
                  <div className="chart-container" style={{ width: '500px', height: '300px' }}>
                    <Text strong style={{ display: 'block', textAlign: 'center', marginBottom: '10px' }}>
                      Branch-Wise Expense Distribution
                    </Text>
                    <Doughnut data={branchChartData} options={chartOptions} />
                  </div>
                  <div className="chart-container" style={{ width: '500px', height: '300px' }}>
                    <Text strong style={{ display: 'block', textAlign: 'center', marginBottom: '10px' }}>
                      Category-Wise Expense Distribution
                    </Text>
                    <Doughnut data={categoryChartData} options={chartOptions} />
                  </div>
                </Space>
              ) : (
                <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                  No data to display
                </Text>
              )}
            </Card>

            <Card
              className="line-chart-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
              }}
            >
              {filteredEntries.length > 0 ? (
                <div style={{ padding: '20px' }}>
                  <Space
                    direction="vertical"
                    style={{ width: '100%', alignItems: 'center' }}
                  >
                    <Text strong style={{ fontSize: '16px' }}>
                      Date-Wise Expense Trends
                    </Text>
                    <RadioGroup
                      className="circle-radio"
                      value={lineGraphView}
                      onChange={(e) => setLineGraphView(e.target.value)}
                      buttonStyle="solid"
                    >
                      <RadioButton value="branch">Branch-Wise</RadioButton>
                      <RadioButton value="expense">Expense-Wise</RadioButton>
                    </RadioGroup>
                    <div className="line-chart-container">
                      <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                  </Space>
                </div>
              ) : (
                <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                  No data to display
                </Text>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseEntry;