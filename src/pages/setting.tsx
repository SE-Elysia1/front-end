import "./setting.css"

export default function Settings() {
  return (
    <section className="page settings-page">
      <header className="page-header">
        <h2 className="page-title">Pengaturan</h2>
        <p className="page-subtitle">Manajemen akun pengguna dan preferensi aplikasi</p>
      </header>

      <div className="card settings-card">
        <div className="setting-row">
          <span>Notifikasi Email</span>
          <button className="btn secondary" type="button">Aktif</button>
        </div>
        <div className="setting-row">
          <span>Mode Kasir Cepat</span>
          <button className="btn secondary" type="button">Nonaktif</button>
        </div>
      </div>
    </section>
  )
}
