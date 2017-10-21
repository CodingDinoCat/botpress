import React, { Component } from 'react'
import { Button, Label } from 'react-bootstrap'

import ReactDOM from 'react-dom'
import classnames from 'classnames'
import axios from 'axios'
import _ from 'lodash'

const {
  DiagramWidget,
  DiagramEngine,
  DefaultNodeFactory,
  DefaultLinkFactory,
  DiagramModel,
  DefaultNodeModel,
  DefaultPortModel,
  LinkModel
} = require('storm-react-diagrams')

import { StandardNodeModel, StandardWidgetFactory } from './nodes/StandardNode'

const style = require('./style.scss')

export default class FlowBuilder extends Component {
  constructor(props) {
    super(props)
    this.state = {}

    this.diagramEngine = new DiagramEngine()

    this.diagramEngine.registerNodeFactory(new DefaultNodeFactory())
    this.diagramEngine.registerNodeFactory(new StandardWidgetFactory())

    this.diagramEngine.registerLinkFactory(new DefaultLinkFactory())

    this.setModel()
  }

  setTranslation(x = 0, y = 0) {
    this.activeModel.setOffset(x, y)
    this.diagramWidget.fireAction()
    this.diagramWidget.forceUpdate()
  }

  serialize() {
    return this.activeModel.serializeDiagram()
  }

  setModel() {
    this.activeModel = new DiagramModel()
    this.activeModel.setGridSize(25)

    const currentFlow = this.props.currentFlow
    if (!currentFlow) {
      return
    }

    const nodes = currentFlow.nodes.map(node => {
      const model = new StandardNodeModel(node)
      model.x = node.x
      model.y = node.y
      return model
    })

    nodes.forEach(node => this.activeModel.addNode(node))

    this.diagramEngine.setDiagramModel(this.activeModel)
    this.diagramWidget.forceUpdate()
  }

  syncModel() {
    // Remove nodes that have been deleted
    _.keys(this.activeModel.getNodes()).forEach(nodeId => {
      if (!_.find(this.props.currentFlow.nodes, { id: nodeId })) {
        this.activeModel.removeNode(nodeId)
      }
    })

    this.props.currentFlow &&
      this.props.currentFlow.nodes.forEach(node => {
        const model = this.activeModel.getNode(node.id)

        if (model === null) {
          // Node was added
          const model = new StandardNodeModel(node)
          model.x = node.x
          model.y = node.y
          this.activeModel.addNode(model)
        }

        _.assign(model, {
          name: node.name,
          onEnter: node.onEnter,
          onReceive: node.onReceive,
          next: node.next
        })
      })

    this.diagramWidget.forceUpdate()
  }

  getSelectedNode() {
    return _.first(this.activeModel.getSelectedItems() || [], { selected: true })
  }

  componentDidMount() {
    ReactDOM.findDOMNode(this.diagramWidget).addEventListener('mousedown', ::this.onDiagramClick)
    ReactDOM.findDOMNode(this.diagramWidget).addEventListener('click', ::this.onDiagramClick)
  }

  componentWillUnmount() {
    ReactDOM.findDOMNode(this.diagramWidget).removeEventListener('mousedown', ::this.onDiagramClick)
    ReactDOM.findDOMNode(this.diagramWidget).removeEventListener('click', ::this.onDiagramClick)
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.currentFlow || _.get(prevProps, 'currentFlow.name') !== _.get(this, 'props.currentFlow.name')) {
      // Update the diagram model only if we changed the current flow
      this.setModel()
    } else {
      // Update the current model with the new properties
      this.syncModel()
    }
  }

  onDiagramClick(event) {
    const selectedNode = this.getSelectedNode()
    const currentNode = this.props.currentFlowNode

    if (this.props.currentDiagramAction && this.props.currentDiagramAction.startsWith('insert_')) {
      let { x, y } = this.diagramEngine.getRelativePoint(event.clientX, event.clientY)

      const zoomFactor = this.activeModel.getZoomLevel() / 100

      x /= zoomFactor
      y /= zoomFactor

      x -= this.activeModel.getOffsetX() / zoomFactor
      y -= this.activeModel.getOffsetY() / zoomFactor

      this.props.createFlowNode({ x, y })
      this.props.setDiagramAction(null)
    }

    // No node selected
    if (!selectedNode && currentNode) {
      return this.props.switchFlowNode(null)
    }

    // Selected a new node
    if (selectedNode && (!currentNode || selectedNode.id !== currentNode.id)) {
      this.props.switchFlowNode(selectedNode.id)
    }
  }

  render() {
    const isInserting = this.props.currentDiagramAction && this.props.currentDiagramAction.startsWith('insert_')
    const classNames = classnames({ [style.insertNode]: isInserting })
    const cancelInsert = () => this.props.setDiagramAction(null)

    return (
      <div className={classNames} style={{ width: '100%', height: '100%' }}>
        {isInserting && (
          <div className={style.insertMode}>
            <div>
              <Label bsStyle="primary">Insertion Mode</Label>
            </div>
            <Button bsStyle="danger" onClick={cancelInsert}>
              Cancel
            </Button>
          </div>
        )}
        <DiagramWidget ref={w => (this.diagramWidget = w)} deleteKeys={[]} diagramEngine={this.diagramEngine} />
      </div>
    )
  }
}
