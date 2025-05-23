import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Input, Typography, Space, Card, Spin, Radio } from 'antd';
import { RedoOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

// Import missing sub-components explicitly
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;
const { Text } = Typography;
const { Group: RadioGroup, Button: RadioButton } = Radio;

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// Register Chart.js components and the datalabels plugin
ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels, BarElement, CategoryScale, LinearScale);

// Custom plugin to display title in the center of the doughnut chart
const centerTitlePlugin = {
  id: 'centerTitle',
  afterDraw(chart) {
    const { ctx, chartArea, options } = chart;
    const centerTitle = options.plugins.centerTitle?.text || '';
    if (!centerTitle) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#000';

    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    const words = centerTitle.split(' ');
    if (words.length > 1) {
      ctx.fillText(words[0], centerX, centerY - 10);
      ctx.fillText(words[1], centerX, centerY + 10);
    } else {
      ctx.fillText(centerTitle, centerX, centerY);
    }

    ctx.restore();
  },
};

ChartJS.register(centerTitlePlugin);

const ExpenseEntry = () => {
  const [closingEntries, setClosingEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [branchFilter, setBranchFilter] = useState(null);
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);

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
      datalabels: {
        color: '#fff',
        formatter: (value, context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
          return `${percentage}%`;
        },
        font: {
          weight: 'bold',
          size: 14,
        },
        anchor: 'center',
        align: 'center',
        textAlign: 'center',
      },
    },
    maintainAspectRatio: false,
  };

  const branchChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      centerTitle: {
        text: 'Branch-Wise',
      },
    },
  };

  const categoryChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      centerTitle: {
        text: 'Category-Wise',
      },
    },
  };

  const barChartData = useMemo(() => {
    const currentDate = dayjs('2025-05-23'); // Current date: May 23, 2025
    const targetMonth = currentDate.month(); // 4 (May)
    const targetYear = currentDate.year(); // 2025
    const daysInMonth = currentDate.daysInMonth(); // 31 days for May
    const currentDay = currentDate.date(); // 23

    // Create labels for the X-axis (dates 1 to 23)
    const labels = Array.from({ length: currentDay }, (_, i) => (i + 1).toString());

    // Initialize arrays to store daily expenses and category-wise breakdown
    const dailyExpenses = Array(currentDay).fill(0);
    const dailyCategoryExpenses = Array(currentDay).fill().map(() => ({}));

    // Process filtered entries to sum expenses by day and category
    const dateEntries = filteredEntries.map(entry => ({
      date: dayjs(entry.date),
      entry,
    }));

    dateEntries.forEach(({ date, entry }) => {
      if (
        date.month() === targetMonth &&
        date.year() === targetYear &&
        date.date() <= currentDay
      ) {
        const dayIndex = date.date() - 1; // 0-based index for the array
        dailyExpenses[dayIndex] += entry.expenses || 0;

        // Sum expenses by category for this day
        entry.expenseDetails.forEach((detail) => {
          const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
          const amount = detail.amount || 0;
          dailyCategoryExpenses[dayIndex][reason] = (dailyCategoryExpenses[dayIndex][reason] || 0) + amount;
        });
      }
    });

    // Calculate the maximum expense for Y-axis scaling
    const maxExpense = Math.max(...dailyExpenses, 1); // Avoid 0 max

    return {
      labels,
      datasets: [
        {
          label: 'Daily Expenses',
          data: dailyExpenses,
          backgroundColor: '#36A2EB',
          borderColor: '#36A2EB',
          borderWidth: 1,
        },
      ],
      maxExpense,
      dailyCategoryExpenses, // Pass category-wise data for tooltip
    };
  }, [filteredEntries]);

  const barChartOptions = {
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
            const dayIndex = context.dataIndex;
            const totalAmount = context.raw || 0;
            const categories = barChartData.dailyCategoryExpenses[dayIndex];

            // Start with the total amount
            const tooltipLines = [`Amount: ₹${totalAmount}`];

            // Add category-wise breakdown
            expenseCategories.forEach((category) => {
              const amount = categories[category] || 0;
              if (amount > 0) {
                tooltipLines.push(`${category}: ₹${amount}`);
              }
            });

            return tooltipLines;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            weight: 'bold',
          },
        },
        ticks: {
          autoSkip: false,
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
        max: Math.ceil(barChartData.maxExpense * 1.1), // 10% padding above the max expense
        ticks: {
          callback: (value) => `₹${value}`,
        },
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
              {exp.recipient || 'N/A'}: <strong>₹{exp.amount || 0}</strong>
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
            .filter-section, .bar-chart-section {
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
              justifyContent: 'space-around',
              page-break-before: auto;
            }
            .chart-container.doughnut {
              width: 500px !important;
              height: 300px !important;
            }
            .chart-container.bar {
              width: 90vw;
              max-width: 1400px;
              height: 60vh;
              min-height: 500px;
              min-width: 800px;
              margin: 0 auto;
            }
            @media (max-width: 1024px) {
              .chart-container.bar {
                width: 95vw;
                min-width: 600px;
                height: 50vh;
                min-height: 400px;
              }
              .chart-container.doughnut {
                width: 400px !important;
                height: 250px !important;
              }
            }
            @media (max-width: 768px) {
              .chart-container.bar {
                width: 98vw;
                min-width: 400px;
                height: 40vh;
                min-height: 350px;
              }
              .chart-container.doughnut {
                width: 350px !important;
                height: 200px !important;
              }
            }
            @media (max-width: 480px) {
              .chart-container.bar {
                width: 98vw;
                min-width: 300px;
                height: 35vh;
                min-height: 300px;
              }
              .chart-container.doughnut {
                width: 300px !important;
                height: 180px !important;
              }
            }
            @media print {
              .chart-container.doughnut {
                width: 300px !important;
                height: 300px !important;
              }
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
                  <div className="chart-container doughnut" style={{ width: '500px', height: '300px' }}>
                    <Doughnut data={branchChartData} options={branchChartOptions} />
                  </div>
                  <div className="chart-container doughnut" style={{ width: '500px', height: '300px' }}>
                    <Doughnut data={categoryChartData} options={categoryChartOptions} />
                  </div>
                </Space>
              ) : (
                <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                  No data to display
                </Text>
              )}
            </Card>

            <Card
              className="bar-chart-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              {filteredEntries.length > 0 ? (
                <div style={{ padding: '20px' }}>
                  <Text strong style={{ fontSize: '16px', display: 'block', textAlign: 'center', marginBottom: '10px' }}>
                    Date-Wise Expenses (May 2025)
                  </Text>
                  <div className="chart-container bar">
                    <Bar data={barChartData} options={barChartOptions} />
                  </div>
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