'use strict';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import url from 'url';
import { parseAndLogError } from './mixins';
import { content_views, listing_titles, bindEvent, unbindEvent } from './globals';

var lookup_column = function (result, column) {
    var value = result;
    var names = column.split('.');
    for (var i = 0, len = names.length; i < len && value !== undefined; i++) {
        value = value[names[i]];
    }
    return value;
};

var Collection = module.exports.Collection = createReactClass({
    render: function () {
        var context = this.props.context;
        return (
            <div>
                <div className="container">
                    <header className="row">
                        <div className="col-sm-12">
                            <h2>{context.title}</h2>
                        </div>
                    </header>
                    <p className="description">{context.description}</p>
                </div>
                <Table {...this.props} />
            </div>
        );
    }
});

content_views.register(Collection, 'collection');


class Cell {
    constructor(value, sortable) {
        this.value = value;
        this.sortable = sortable;
    }
}


class Row {
    constructor(item, cells, text) {
        this.item = item;
        this.cells = cells;
        this.text = text;
    }
}


class Data {
    constructor(rows) {
        this.rows = rows;
        this.sortedOn = null;
        this.reversed = false;
    }
    sort(sortColumn, reverse) {
        reverse = !!reverse;
        if (this.sortedOn === sortColumn && this.reversed === reverse) return;
        this.sortedOn = sortColumn;
        this.reversed = reverse;            
        this.rows.sort(function (rowA, rowB) {
            var a = '' + rowA.cells[sortColumn].sortable;
            var b = '' + rowB.cells[sortColumn].sortable;
            if (a < b) {
                return reverse ? 1 : -1;
            } else if (a > b) {
                return reverse ? -1 : 1;
            }
            return 0;
        });
    }
}

var RowView = function (props) {
    var row = props.row;
    var id = row.item['@id'];
    var tds = row.cells.map( function (cell, index) {
        var cellValue = (typeof cell.value === 'object') ? cell.value.join(', ') : cell.value;
        if (index === 0) {
            return (
                <td key={index}><a href={row.item['@id']}>{cellValue}</a></td>
            );
        }
        return (
            <td key={index}>{cellValue}</td>
        );
    });
    return (
        <tr key={id} hidden={props.hidden} data-href={id}>{tds}</tr>
    );
};

var Table = module.exports.Table = createReactClass({
    contextTypes: {
        fetch: PropTypes.func
    },

    getDefaultProps: function () {
        return {
            defaultSortOn: 0
        };
    },

    getInitialState: function () {
        var state = this.extractParams(this.props);
        state.columns = this.guessColumns(this.props);
        state.data = new Data([]);  // Tables may be long so render empty first
        state.communicating = true;
        return state;
    },

    componentWillReceiveProps: function (nextProps) {
        var updateData = false;
        if (nextProps.context !== this.props.context) {
            updateData = true;
            this.setState({
                communicating: this.fetchAll(nextProps)
            });
        }
        if (nextProps.columns !== this.props.columns) {
            updateData = true;
        }
        if (updateData) {
            var columns = this.guessColumns(nextProps);
            this.extractData(nextProps, columns);
        }
        if (nextProps.href !== this.props.href) {
            this.extractParams(nextProps);
        }

    },

    extractParams: function(props) {
        var params = url.parse(props.href, true).query;
        var sorton = parseInt(params.sorton, 10);
        if (isNaN(sorton)) {
            sorton = props.defaultSortOn;
        }
        var state = {
            sortOn: sorton,
            reversed: params.reversed || false,
            searchTerm: params.q || ''
        };
        this.setState(state);
        return state;
    },

    guessColumns: function (props) {
        var column_list = props.context.columns;
        var columns = [];
        if (!column_list || Object.keys(column_list).length === 0) {
            for (var key in props.context['@graph'][0]) {
                if (key.slice(0, 1) != '@' && key.search(/(uuid|_no|accession)/) == -1) {
                    columns.push(key);
                }
            }
            columns.sort();
            columns.unshift('@id');
        } else {
            for(var column in column_list) {
                columns.push(column);
            }
        }
        this.setState({columns: columns});
        return columns;
    },

    extractData: function (props, columns) {
        var context = props.context;
        columns = columns || this.state.columns;
        var rows = context['@graph'].map(function (item) {
            var cells = columns.map(function (column) {
                var factory;
                // cell factories
                //if (factory) {
                //    return factory({context: item, column: column});
                //}
                var value = lookup_column(item, column);
                if (column == '@id') {
                    factory = listing_titles.lookup(item);
                    value = factory({context: item});
                } else if (value === null) {
                    value = '';
                } else if (value instanceof Array) {
                    value = value;
                } else if (value['@type']) {
                    factory = listing_titles.lookup(value);
                    value = factory({context: value});
                }
                var sortable = ('' + value).toLowerCase();
                return new Cell(value, sortable);
            });
            var text = cells.map(function (cell) {
                return cell.value;
            }).join(' ').toLowerCase();
            return new Row(item, cells, text);
        });
        var data = new Data(rows);
        this.setState({data: data});
        return data;
    },

    fetchAll: function (props) {
        var context = props.context;
        var communicating;
        var request = this.state.allRequest;
        if (request) request.abort();
        var self = this;
        if (context.all) {
            communicating = true;
            request = this.context.fetch(context.all, {
                headers: {'Accept': 'application/json'}
            });
            request.then(response => {
                if (!response.ok) throw response;
                return response.json();
            })
            .catch(parseAndLogError.bind(undefined, 'allRequest'))
            .then(data => {
                self.extractData({context: data});
                self.setState({communicating: false});
            });
            this.setState({
                allRequest: request,
                communicating: true
            });
        }
        return communicating;
    },

    render: function () {
        var columns = this.state.columns;
        var context = this.props.context;
        var defaultSortOn = this.props.defaultSortOn;
        var sortOn = this.state.sortOn;
        var reversed = this.state.reversed;
        var searchTerm = this.state.searchTerm;
        this.state.searchTerm = searchTerm;
        var titles = context.columns || {};
        var data = this.state.data;
        var params = url.parse(this.props.href, true).query;
        var total = context.count || data.rows.length;
        data.sort(sortOn, reversed);
        var self = this;
        var headers = columns.map(function (column, index) {
            var className;
            if (index === sortOn) {
                className = reversed ? "tcell-desc" : "tcell-asc";
            } else {
                className = "tcell-sort";
            }
            return (
                <th onClick={self.handleClickHeader} key={index}>
                    {titles[column] && titles[column]['title'] || column}
                    <i className={className}></i>
                </th>
            );
        });
        var searchTermLower = this.state.searchTerm.trim().toLowerCase();
        var matching = [];
        var not_matching = [];
        // Reorder rows so that the nth-child works
        if (searchTerm) {
            data.rows.forEach(function (row) {
                if (row.text.indexOf(searchTermLower) == -1) {
                    not_matching.push(row);
                } else {
                    matching.push(row);
                }
            });
        } else {
            matching = data.rows;
        }
        var rows = matching.map(function (row) {
            return RowView({row: row});
        });
        rows.push.apply(rows, not_matching.map(function (row) {
            return RowView({row: row, hidden: true});
        }));
        var loading_or_total;
        if (this.state.communicating) {
            loading_or_total = <i className="icon icon-refresh icon-spin"></i>;
        } else {
            loading_or_total = <span>Displaying {matching.length} of {total} records</span>;
        }

        return (
            <div>
                <div className="table-meta">
                    <div className="container">
                        <div className="row table-summary">
                            <div className="col-sm-6 table-count">
                                {loading_or_total}
                            </div>
                            <form ref="form" className="form-inline col-sm-6 table-filter" onKeyUp={this.handleKeyUp} 
                                data-skiprequest="true" data-removeempty="true">
                                <div className="form-group table-filter-input">
                                    <label htmlFor="table-filter">Filter table by:</label>
                                    <input ref="q" disabled={this.state.communicating || undefined} 
                                        name="q" type="search" defaultValue={searchTerm} 
                                        className="form-control" id="table-filter" /> 
                                    <i className="icon icon-times-circle clear-input-icon" hidden={!searchTerm} onClick={this.clearFilter}></i>
                                </div>
                                <input ref="sorton" type="hidden" name="sorton" defaultValue={sortOn !== defaultSortOn ? sortOn : ''} />
                                <input ref="reversed" type="hidden" name="reversed" defaultValue={!!reversed || ''} />
                            </form>
                        </div>
                    </div>
                </div>
                <div className="container">
                    <div className="table-responsive">
                        <table className="table table-striped table-bordered table-condensed sticky-area">
                            <thead className="sticky-header">
                                <tr className="col-headers">
                                    {headers}
                                </tr>
                            </thead>
                            <tbody>
                                {rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    },

    componentDidMount: function () {
        this.setState({
            data: this.extractData(this.props),
            communicating: this.fetchAll(this.props),
            mounted: true
        });
    },

    handleClickHeader: function (event) {
        var target = event.target;
        while (target.tagName != 'TH') {
            target = target.parentElement;
        }
        var cellIndex = target.cellIndex;
        var reversed = '';
        var sorton = this.refs.sorton;
        if (this.props.defaultSortOn !== cellIndex) {
            sorton.value = cellIndex;
        } else {
            sorton.value = '';
        }
        if (this.state.sortOn == cellIndex) {
            reversed = !this.state.reversed || '';
        }
        this.refs.reversed.value = reversed;
        event.preventDefault();
        event.stopPropagation();
        this.submit();
    },

    handleKeyUp: function (event) {
        if (typeof this.submitTimer != 'undefined') {
            clearTimeout(this.submitTimer);
        }
        // Skip when enter key is pressed
        if (event.nativeEvent.keyCode == 13) return;
        // IE8 should only submit on enter as page reload is triggered
        if (!this.hasEvent) return;
        this.submitTimer = setTimeout(this.submit, 200);
    },

    hasEvent: typeof Event !== 'undefined',

    submit: function () {
        // form.submit() does not fire onsubmit handlers...
        var target = this.refs.form;

        // IE8 does not support the Event constructor
        if (!this.hasEvent) {
            target.submit();
            return;
        }

        var event = new Event('submit', {bubbles: true, cancelable: true});
        target.dispatchEvent(event);
    },
    
    clearFilter: function (event) {
        this.refs.q.value = '';
        this.submitTimer = setTimeout(this.submit);
    }, 

    componentWillUnmount: function () {
        if (typeof this.submitTimer != 'undefined') {
            clearTimeout(this.submitTimer);
        }
        var request = this.state.allRequest;
        if (request) request.abort();
    }

});
