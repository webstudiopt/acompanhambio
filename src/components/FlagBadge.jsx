export default function FlagBadge({ size = 28 }) {
  return (
    <span className="flag-badge" style={{ width: size, height: size }} aria-hidden="true">
      <span className="flag-stripe flag-green" />
      <span className="flag-stripe flag-white" />
      <span className="flag-stripe flag-orange" />
    </span>
  )
}
