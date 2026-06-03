import * as XLSX from 'xlsx'
import fs from 'node:fs'

const filePath = process.argv[2]
if (!filePath) {
  throw new Error('Missing xlsx path')
}

const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
const summary = workbook.SheetNames.map((name) => {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' })
  return { sheet: name, rows: rows.length }
})

console.log(JSON.stringify(summary, null, 2))
