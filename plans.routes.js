const express = require('express');
const db = require('./db');

const router = express.Router();

function serializePlan(p) {
  return {
    id: p.id, tier: p.tier, name: p.name, tag: p.tag,
    price: p.price, cores: p.cores, ram: p.ram, disk: p.disk,
    port: p.port, bw: p.bw, backup: !!p.backup,
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM plans ORDER BY tier, sort_order');
    const rows = result.rows;
    res.json({
      essential: rows.filter(p => p.tier === 'essential').map(serializePlan),
      premium: rows.filter(p => p.tier === 'premium').map(serializePlan),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener los planes.' });
  }
});

module.exports = router;
