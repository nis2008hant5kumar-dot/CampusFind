const demoItems = [
  {
    id: 'demo-item-1001',
    name: 'Wireless Headphones',
    status: 'Found',
    category: 'Electronics',
    description: 'Over-ear wireless headphones in a dark case.',
    location: 'Learning commons',
    reported: '2026-10-16',
  },
  {
    id: 'demo-item-1002',
    name: 'Key Set',
    status: 'Lost',
    category: 'Keys',
    description: 'A set of two silver keys with a plain dark key fob.',
    location: 'Cafeteria vicinity',
    reported: '2026-10-15',
  },
  {
    id: 'demo-item-1003',
    name: 'Grey Backpack',
    status: 'Found',
    category: 'Bags & Personal Items',
    description: 'A grey backpack with several compartments.',
    location: 'Near the student centre',
    reported: '2026-10-14',
  },
  {
    id: 'demo-item-1004',
    name: 'Grid Paper Notebook',
    status: 'Lost',
    category: 'Books & Stationery',
    description: 'A medium-sized notebook with a dark green cover.',
    location: 'Academic block study area',
    reported: '2026-10-13',
  },
  {
    id: 'demo-item-1005',
    name: 'Blue Water Bottle',
    status: 'Found',
    category: 'Other',
    description: 'A reusable blue bottle with a screw-top lid.',
    location: 'Sports complex entrance',
    reported: '2026-10-12',
  },
]

const itemStatuses = [...new Set(demoItems.map((item) => item.status))]
const itemCategories = [
  ...new Set([
    ...demoItems.map((item) => item.category),
    'Cards & Wallets',
  ]),
]

module.exports = { demoItems, itemStatuses, itemCategories }
