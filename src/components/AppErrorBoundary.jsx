import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Erro inesperado ao renderizar a aplicação.",
    };
  }

  componentDidCatch(error, info) {
    console.error("Erro de renderização capturado pelo boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bi-loading" style={{ minHeight: "100vh", padding: "32px" }}>
          <div className="bi-panel" style={{ maxWidth: "720px", width: "100%" }}>
            <div className="bi-panel-header">
              <h3>Não foi possível abrir o painel</h3>
            </div>
            <div className="bi-narrative">
              <p>{this.state.message || "Erro inesperado ao renderizar a aplicação."}</p>
              <p>O sistema agora continua acessível para navegação mesmo quando uma página falha.</p>
              <p>
                <a href="/">Voltar para a página inicial</a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
